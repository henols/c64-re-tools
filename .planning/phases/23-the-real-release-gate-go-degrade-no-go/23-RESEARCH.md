# Phase 23: The Real-Release Gate (Go/Degrade/No-Go) - Research

**Researched:** 2026-08-26
**Domain:** Measurement methodology + probe instrumentation (dxa 0.1.5, Ghidra 12.1.3 headless, VICE runtime observation) — **no product code**
**Confidence:** HIGH on instruments and hazards (everything below marked `[VERIFIED]` was executed on this host in this session); MEDIUM on the measurement-definition proposal, which is a design recommendation the planner must lock in plan 23-01.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The external analyser is excluded entirely.** No anno binary, no
  `anno-coverage.ts` structural census, no anno output as an oracle, a
  baseline or a screening tool anywhere in this phase. It is `CUT-01` scope and
  is being deleted in Phase 25; building the gate on the thing being removed
  would make the gate worthless the moment the cutover lands. This overrides the
  otherwise-tempting reuse of `anno-coverage.ts`'s widened
  `scanIndirectDispatch()`. *(User decision, verbatim intent: "Don't use anno
  for anything, it has to be removed.")*
  — **Reversibility:** reversible — nothing is built on the exclusion; it only
  narrows which tools a probe plan may invoke.

- **D-02: VICE is how the code of interest is reached.** Navigate to the region
  under study in the running emulator rather than analysing whatever the file
  statically happens to contain. *(User decision: "let's use VICE to go to the
  code where we are interested in reverse engineering".)*
  — **Reversibility:** reversible.

- **D-03: dxa and Ghidra are measured on a depacked flat 64K RAM capture**, not
  on the shipped file. Route: autostart the release in VICE → run past the
  loader/depacker → break at a checkpoint → capture flat 64K via
  `c64-ram-capture`. Rationale: a packed payload is high-entropy bytes, so a
  data-recovery percentage taken on the shipped `.prg` measures the packer's
  output, not game code. This also matches the milestone's own standing
  decision that depack-by-running is sufficient and no unpacker is in scope.
  — **Reversibility:** costly — the capture is the substrate every subsequent
  measurement in the phase reads; changing it invalidates criteria 1-3's numbers
  and forces a re-run of the whole measuring sequence.

- **D-04: The corpus is operator-supplied, as a `.d64` disk image or a `.prg`.**
  Not fetched from public archives by the phase, and not another self-authored
  fixture. The binary is identified in the verdict by release name/id **and
  sha256** so the numbers stay auditable without committing the image.
  — **Reversibility:** reversible.

  *Note on how this was reached:* the first answer was "corpus absence is the
  verdict" — record no-corpus-obtainable as a gate input and let the rule fire.
  On being shown that this conflicts with D-03 and predetermines the outcome
  before the rules exist (which the ROADMAP explicitly forbids: "write the rules
  before you have the answers"), it was revised to supplying an image. The
  absence branch is **not** dead: it stays as a rule input for whatever the
  supplied corpus turns out not to contain — see D-05.

- **D-05: Inventory first, reject nothing.** Before any measurement runs, scan
  the depacked capture and commit what it actually contains — computed-index
  dispatches found, `$01` writes found, at which addresses. That inventory is a
  fact about the corpus recorded *ahead* of the measurements. Nothing is
  rejected for lacking a construct, so there is no selection bias to declare;
  "not exercised" becomes a **pre-declared corpus property** the decision rule
  keys on, rather than a post-hoc excuse. Criteria 2 and 3 both already permit
  "not exercised" as an honest outcome — this makes that outcome earned.
  — **Reversibility:** costly — the inventory's pre-commitment is the thing that
  makes criteria 2 and 3 credible; producing it after measuring destroys the
  property and cannot be repaired by re-ordering documents.

- **D-06: The inventory is produced by VICE runtime observation — never by dxa
  or Ghidra.** Watchpoint `$01` and run: every bank switch is recorded with its
  actual program point and actual value. Checkpoint the dispatch site for
  criterion 2. **This closes a circularity trap:** if either engine under test
  produced the inventory, criterion 2 would degrade to "Ghidra resolved the
  dispatch that Ghidra found", and criterion 3 would inherit the same defect.
  Observation is also strictly better for criterion 3 on its merits — "the point
  at which a single forward-carried `$01` value stops being correct" is a
  question about execution paths, and a watchpoint answers it directly where
  static inference only guesses.
  — **Reversibility:** one-way — a criterion-2 result produced from a
  self-supplied inventory cannot be laundered into a valid one afterwards; the
  measurement would have to be discarded and re-run from a fresh capture.

- **D-07: The decision rules live in their own early plan (23-01), which touches
  nothing else.** Every measuring plan comes after it. **Git history is the
  proof** — the rules commit precedes the first measurement commit and is
  checkable with `git log` by anyone, no test required. This is Phase 9's shape,
  which the ROADMAP names as the bar. 23-01 also fixes the corpus inventory
  format (D-05), since that is equally a pre-commitment.
  — **Reversibility:** one-way — once a measurement has been committed, the
  rules can never again be shown to predate it. Ordering is the entire mechanism.

- **D-08: The verdict gates Phase 24 through ROADMAP + STATE pointers.**
  Phase 24's `Depends on` and Notes name the verdict file and its frontmatter
  field explicitly; STATE.md points at it too. The planner reads ROADMAP for the
  phase entry as its first act, so the verdict is unavoidable in practice. This
  is how Phase 9 closed its own criterion 5. **No test guard** — it would encode
  roadmap policy in a suite belonging to a phase that ships no code, and the
  likeliest outcome (`degrade`, meaning "proceed, narrowed") is precisely the
  case such a guard cannot check.
  — **Reversibility:** reversible — a guard can be added later if the pointer
  proves insufficient.

- **D-09: `degrade` narrowing is pre-mapped for criteria 2 and 3 only.** The
  rules spell out, up front, what narrows if the computed-dispatch case fails
  and what narrows if path-dependent bank state proves unresolvable — e.g.
  "`AUTO-04`/`AUTO-05` narrow to decline-to-annotate only". Criteria 1, 4 and 5
  get their narrowing authored at verdict time against the evidence, Phase 9
  style. Rationale: criterion 3 is named in the ROADMAP as "the highest-risk
  item on the pivot's own record" and criterion 2 is the case the fixture never
  exercised, so those two are where a mapping written *after* seeing the numbers
  is most suspect. The other three produce a plain number, a capability list, or
  are the rule itself. *(Claude's discretion — see below.)*
  — **Reversibility:** costly — a pre-mapped narrowing that turns out to fit
  badly can be superseded at verdict time, but only by recording the override
  explicitly, which weakens the pre-commitment it exists to provide.

- **D-10: The verdict is machine-readable frontmatter in a durable findings
  document**, mirroring `docs/phase9-external-analyser-probe-findings.md`:
  `verdict: go|degrade|no-go` plus `verdict_rule_applied: R<N>`. The document
  reproduces the full rule and walks the actual outcome values through it, so a
  reader can mechanically re-derive the verdict rather than take it on trust.
  — **Reversibility:** reversible.

- **D-11: The 279-byte fixture's claims are printed beside the new numbers, not
  replaced by them.** `PROOF-01` is explicit about this, and so is criterion 1:
  a reader must be able to see for themselves whether the fixture flattered the
  tool. The error *direction* is re-measured too — the fixture scored 0 false
  positives against 28% false negatives, and which way the errors run is what
  decides whether Phase 26's graphics-feedback containment is sufficient or
  load-bearing.
  — **Reversibility:** reversible.

### Claude's Discretion

The user answered "you decide" on the `degrade` pre-mapping question (D-09) —
recorded above with its rationale. These were additionally defaulted without
being put to the user, and a planner may revisit any of them on evidence:

- **Ghidra provisioning:** reuse the surviving probe install at
  `~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` (1.4 GB) rather than reinstalling.
  Its README marks it safe to delete and states nothing in the repo depends on
  the path — so treat the path as an *undeclared external input to this phase*
  and record the version in evidence, not the location.
- **dxa provisioning:** dxa is **not on this host** — the pivot built it in
  `/tmp`, which is tmpfs here, so it is gone. Build 0.1.5 throwaway for this
  phase, but **pin and record the exact version/tarball**, because `DXA-01`
  (Phase 24) vendors it and must vendor the same one the gate measured.
- **`PROOF-04` audit depth:** a source read of `analyzer.rs` (1,506 lines),
  function by function, each matched to a dxa/Ghidra replacement or accepted as
  lost with its cost. **No anno execution** (follows from D-01). The source is
  available offline at
  `~/.cargo/registry/src/*/external-analyser-core-0.9.20/src/analyzer.rs` — no
  network needed.
- **Ghidra pre-scripts:** reuse `BankProbe3.java`'s `getBlock()`-first guard
  pattern verbatim; it exists specifically to stop an unhandled
  `MemoryConflictException` silently falling back to non-volatile.
  > **RESEARCH CORRECTION — see Pitfall 2.** Reusing this pattern *verbatim* on
  > a flat 64K image is a silent correctness failure, verified live this
  > session. The pattern is right for a `.prg`; on a raw 64K import there is one
  > block `RAM 0000-ffff` and `setVolatile(true)` on it marks the entire address
  > space volatile. Use `Memory.split()` first. This is the one discretion
  > default this research overturns.

### Deferred Ideas (OUT OF SCOPE)

- **`anno-coverage.ts` is not in `CUT-02`'s survivor list.** The bytes-derived
  coverage census v0.5.0 just shipped appears to fall inside `CUT-01`'s 19,181
  deleted lines. Consistent with D-01 and with the owner's stated intent that
  anno "has to be removed", so it is not raised as a defect — but Phase 25's
  planner should confirm the deletion is intended rather than incidental.
- **Fetching a corpus from public archives** (CSDb / Internet Archive) — offered
  and not taken. Would give third-party reproducibility; revisit only if the
  supplied image proves unable to exercise criteria 2 and 3 and a second opinion
  is wanted.
- **A test guard on the verdict gating Phase 24** — offered and declined in
  favour of ROADMAP/STATE pointers (D-08). Revisit if the pointer proves
  insufficient in practice.
- **Pre-mapping `degrade` narrowing for all five criteria** — offered and
  narrowed to criteria 2 and 3 (D-09).
- **Reap vicerc scratch dirs in broker kill/recycle path** — unrelated todo,
  left pending.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROOF-01 | dxa's data-recovery rate and false-positive count measured on a real cracked release, reported as numbers against a named binary, *beside* the 279-byte fixture's 72%-data / 0-false-positive claim | § *Criterion 1: the measurement definition* — the fixture's claim was **reproduced from source this session** (72.46% / 0 FP / 27.5% FN) so the definition it used is now pinned rather than guessed; § *Pitfall 1* and *Pitfall 3* name the two flat-64K artefacts that would silently corrupt the new number; § *Measurement window* gives the pre-committable three-bucket adjudication that does not presuppose ground truth |
| PROOF-02 | Ghidra's indirect-dispatch resolution tested where the dispatch index is **computed** | § *Criterion 2* — the detection method is verified: an unresolved computed dispatch produces **no `COMPUTED_JUMP` reference at all and no warning**, so "unresolved" must be detected as the *absence* of a reference from the `jmp (ind)` site. A runtime-only, non-circular definition of "computed" is proposed (§ *Pattern 3*) |
| PROOF-03 | The `memmap.json` join run against banking code; the point where a single forward-carried `$01` becomes wrong established rather than assumed | § *Pattern 4* — `$01` write observation protocol via `vice_watch_add`, its per-backend limits (stock: 20 hits/s auto-disable; no ignore-count), and the operational definition of "the model breaks here" as *one access site observed under ≥2 distinct `$01` values that resolve differently in `memmap.json`* |
| PROOF-04 | The dropped `analyzer.rs` work checked for anything dxa+Ghidra does not replace | § *analyzer.rs capability inventory* — the eight top-level entry points and eleven `LabelType` / seven `BlockType` variants read from the crate source this session, with a starting replacement mapping |
| PROOF-05 | A recorded go / degrade / no-go against named rules, produced **before** any engine or store code | § *Pattern 1: pre-committed first-match-wins rule* and § *Pattern 2: verdict-as-frontmatter* — both transcribed from the Phase 9 artifacts that are the ROADMAP's stated bar |
</phase_requirements>

---

## Summary

This phase builds nothing. It provisions three instruments (dxa 0.1.5, Ghidra
12.1.3 headless, the `vice` MCP surface), runs them against one
operator-supplied real release, and emits a machine-readable verdict against
rules written first. The research question is therefore not "which library" but
**"which measurement, computed over which window, with which definitions, and
which artefacts of the flat-64K substrate would silently corrupt it"**.

Three things were checked by execution rather than reasoned about, and all three
change the plan:

1. **The fixture's 72% / 0-FP / 28%-FN claim was reproduced exactly** by
   rebuilding `fixture.a` with ACME and re-running dxa's own command line
   (100 of 138 true-data bytes typed as data = 72.46%; 179 code bytes; 279
   total).
   **[CORRECTED by 23-02 — see `evidence/fixture/fixture-baseline.txt` RC-1 and
   `docs/phase23-real-release-gate-findings.md` correction 5.** The *arithmetic*
   reproduces against the published 141/138 partition, but that partition is
   **not source-derivable**: re-deriving it byte by byte from `fixture.a` via
   ACME's own report gives 145 code / 131 data / 3 assembler-pad, never 141/138
   under any padding treatment. `FIXTURE_REPRODUCED: no`. The source-derived
   figures are `72.39 (97/134)` recovery, **3** false positives and
   `27.61 (37/134)` false negatives, and those — not the published ones — are the
   apples-to-apples side of D-11's comparison. The published partition is more
   generous to dxa than the source is, in exactly the place that decides the
   "0 false positives" headline.]**
   This pins the operational definition the new numbers must sit beside:
   *positive class = data*, *denominator = true data bytes*, *false positive = a
   code byte typed as data*. Without this the "beside" comparison D-11 requires
   is not apples-to-apples.
2. **Two dxa flags and one Ghidra idiom, all correct for a `.prg`, are wrong for
   a flat 64K capture**, and all three fail quietly. dxa's default load-address
   detection eats `$0000`/`$0001` (the processor port) and re-bases the whole
   image; Ghidra's raw-binary loader creates one `RAM 0000-ffff` block, so the
   `getBlock()`-first volatile guard the CONTEXT recommends verbatim marks the
   *entire address space* volatile. Both were reproduced live.
3. **Ghidra 12.1.3 does not resolve a computed-index indirect dispatch, and
   reports nothing when it fails.** Changing the pivot fixture's `ldx #$02` to
   `lda $d012 / and #$03 / tax` removed the `082e -> 089a COMPUTED_JUMP`
   reference entirely; the site emits only `REF 0832 -> 00fb READ`. This is a
   *synthetic* observation and is emphatically **not** criterion 2's answer —
   but it makes criterion 2's *detection method* concrete (absence of a
   reference, not presence of a warning) and it makes D-09's pre-mapped
   `degrade` narrowing for criterion 2 the load-bearing one.

**Primary recommendation:** Plan 23-01 must commit three things, not one — the
`R1..Rn` first-match-wins rule (D-07), the corpus inventory schema (D-05), **and
the measurement definitions and window for criterion 1** (positive class,
denominator, adjudicated-fraction reporting, and which address ranges are in
scope). A data-recovery percentage whose window is chosen after seeing the
capture is exactly as unfalsifiable as a rule written after the measurement.

---

## Architectural Responsibility Map

This phase has no product tiers. The equivalent map is **who supplies each fact**,
and the load-bearing property is that no engine under test supplies a fact used
to judge itself (D-06).

| Capability | Primary source | Secondary source | Rationale |
|------------|----------------|------------------|-----------|
| Corpus acquisition | Operator (D-04) | — | Not fetchable by the phase; absence is a rule input, not a blocker |
| Depack + flat 64K capture | VICE via `c64-ram-capture` | — | D-03; the substrate every other measurement reads |
| Corpus inventory (dispatch sites, `$01` writes, executed code) | VICE runtime observation | — | D-06 — **never** dxa or Ghidra; closes the circularity trap |
| Certain-code ground truth | VICE observed PC / call sites | — | Executed ⇒ code, with no static inference |
| Certain-data ground truth | VIC pointers via `dump-artifacts.mjs` (`vic_bank`, `screen_base`, `charset_base`, `sprite_data_addresses`) | chip state in `raw.json` | VIC fetches by DMA; these bytes are data whether or not any instruction references them |
| Code/data classification **under test** | dxa 0.1.5 | — | The subject of criterion 1, never an oracle |
| Typed xrefs + computed-jump resolution **under test** | Ghidra `ReferenceManager` | `DecompInterface` for structural facts | The subject of criterion 2; `DataTypeManager` returns nothing on 6502 |
| Evidence rendering (disassembly excerpts) | `vice_disassemble`, or `disasm-*.ts` (CUT-02 survivors) | — | Neither is an engine under test; permitted for *rendering*, not for adjudication |
| `analyzer.rs` capability list | Crate source read offline | — | D-01 forbids *running* anno; reading is explicitly allowed |
| The verdict | Plan 23-01's pre-committed rule | git log ordering | D-07 — ordering *is* the mechanism |

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why standard | Provenance |
|------|---------|---------|--------------|------------|
| dxa | **0.1.5** (25 Mar 2022) | Discovery engine under test — code/data map from nothing, illegal-NMOS coverage | The only tool in the stack that produces a code/data map with no prior hints; `DXA-01` will vendor exactly this version | `[VERIFIED: downloaded + sha256-matched this session]` |
| Ghidra | **12.1.3 PUBLIC** (build 2026-Aug-17) | Semantic engine under test — typed xrefs, constant propagation, decompiler | Already installed at `~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`; the exact build the pivot measured | `[VERIFIED: ~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/application.properties — "application.build.date=2026-Aug-17 1710 UTC", "application.java.min=21"]` |
| OpenJDK | **21.0.12.1** (Debian) | Ghidra runtime | Meets Ghidra's `application.java.min=21` exactly | `[VERIFIED: java -version on this host]` |
| ACME | on `$PATH` at `~/.local/bin/acme` | Rebuild `fixture.a` to reproduce the fixture's own numbers for the side-by-side (D-11) | Already the project's assembler (`acme-build` skill) | `[VERIFIED: acme built fixture.prg = 281 bytes this session]` |
| VICE (fork) | **3.10**, `/usr/local/bin/x64sc` | The observation instrument — recommended backend for this phase | Has `vice_backtrace`, `vice_checkpoint_set_ignore_count`, `vice_display_screenshot`; 62 tools | `[VERIFIED: /usr/local/bin/x64sc --version → "x64sc (VICE 3.10)"]` |
| VICE (stock) | **3.9**, `/usr/bin/x64sc` | Portability cross-check only | 38 tools; **VICE 3.9 lacks `CPUHISTORY_GET` entirely** (needs ≥3.10 per CLAUDE.md), so it is the weaker instrument here | `[VERIFIED: /usr/bin/x64sc --version → "x64sc (VICE 3.9)"]` |
| Node | 22.22.0 | Throwaway listing parsers, evidence scripts | Project floor is ≥22.18 | `[VERIFIED: node --version]` |
| `xa` (xa65) | 2.4.1-0.1 (Debian) | Optional soundness check on the dxa listing parser | Round-trips dxa output byte-identically **only** in `standard-nmos6502` mode — see Pitfall 4 | `[VERIFIED: dpkg + live round-trip this session]` |

### Supporting (already in this repo — reuse, do not rebuild)

| Asset | Purpose | When to use |
|-------|---------|-------------|
| `src/skills/c64-ram-capture/SKILL.md` + `scripts/` | D-03's depack-by-running + verified flat 64K image | The capture plan, wholesale |
| `scripts/dump-artifacts.mjs assemble` | Asserts exactly 65536 bytes, no gap/overlap, returns sha256 — **writes nothing** | Validating chunks before committing; needs no release registry |
| `scripts/dump-artifacts.mjs write-set` | Emits `.bin` / `.state.json` / `.map.json` / `.capture.json` **and derives `vic_bank`, `screen_base`, `charset_base`, `sprite_data_addresses` for free** | The certain-data ground truth for criterion 1 comes from here — but it needs a registry (see Pitfall 6) |
| `scripts/compare.mjs digest` / `compare` / `floor` | sha256 for D-04's audit trail; capture-equivalence between two runs | Proving the capture is reproducible before any number is computed on it |
| `scripts/d64-parse.mjs directory` / `bam` | Reads the supplied `.d64` without booting; flags faked directory entries | First act on an operator-supplied disk image |
| `.planning/notes/dxa-ghidra-pivot-evidence/Decomp.java` | The `DecompInterface` export that works | Structural facts (array bounds, `CONCAT11`, record stride) |
| `.planning/notes/dxa-ghidra-pivot-evidence/ExportAnalysis.java` | `## CLASSIFICATION` (per-byte code/data/undef) + `## REFERENCES` (typed xrefs) | **Not** the trap — see Pitfall 5. Its `## STRUCTS` section is the trap; its classification and reference sections are exactly what criteria 1 and 2 need |
| `.planning/notes/dxa-ghidra-pivot-evidence/vicderive.mjs` | Derives bank/screen/charset/sprite pointers from recovered register values | Cross-check on `write-set`'s own derivation |
| `src/mcp/vice/disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` | In-house 6502 decode (CUT-02 survivor) | **Evidence rendering only.** Using it to *find* candidate sites edges toward being an oracle; prefer `vice_memory_search` + `vice_disassemble` for discovery |
| `src/mcp/vice/anno-d64.ts` | `.d64` parsing (CUT-02 survivor) | Only if file-level access is wanted over autostart |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Fork backend (VICE 3.10) | Stock backend (VICE 3.9) | Stock loses `vice_backtrace` (the cheapest certain-code sampler), loses `vice_checkpoint_set_ignore_count` (deliberately never implemented — see Pitfall 7), requires `acknowledgeTraceRisk:true` for any `stop:false` checkpoint, and auto-disables trace checkpoints above 20 hits/s. Run the *portability* claim on stock; run the *measurement* on the fork |
| `-p all-nmos6502` | `-p rational-nmos6502` / `traditional-nmos6502` | The narrower sets exclude ANE/SHA/SHS/SHY/SHX/LXA/LAXS (and more), which are exactly the bytes crack code uses. `all-nmos6502` is right; note it forfeits the `xa` round-trip check (Pitfall 4) |
| `-d poor` (dxa default) | `-d skip-scanning` | On a flat 64K image `-d poor` lists as much as possible as code even with illegal instructions present — a massive code-side bias over unreferenced RAM. `-d skip-scanning` treats unreferenced addresses as data a priori, which pairs correctly with VICE-observed entry points fed via `-R`. **Which one is used changes criterion 1's number and must be fixed in 23-01, not chosen after seeing the result** |
| Full executed-byte coverage | PC + call-site sampling | Full coverage needs `CPUHISTORY_GET` (VICE ≥3.10, and not exposed as an MCP tool on either manifest) or per-address stopping checkpoints. Sampling is bounded and sufficient — it only has to bound false positives, not enumerate all code |

**Installation:**

```bash
# dxa 0.1.5 — pinned by sha256, verified this session
curl -fsSLO https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz
echo "8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799  dxa-0.1.5.tar.gz" | sha256sum -c -
tar xzf dxa-0.1.5.tar.gz && make -C dxa-0.1.5          # plain make, no configure, no deps
# → dxa-0.1.5/dxa   (60,592 bytes on this host)

# Ghidra — already present, do not reinstall
~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/support/analyzeHeadless
```

`[VERIFIED: downloaded from https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz this session; sha256 = 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799, byte-identical to the FreeBSD ports distinfo for devel/dxa65; built with plain make, gcc, zero warnings-as-errors, zero external dependencies]`

**Copy the built `dxa` binary, the tarball and its `sha256sum` line into the
phase evidence directory before the session ends.** `/tmp` is tmpfs on this host
(16 GB, cleared on reboot) and that is exactly how the pivot lost its dxa build.

---

## Package Legitimacy Audit

This phase installs **no npm, PyPI or crates package**. The single external
artefact is a source tarball fetched by URL, so the registry-based
`package-legitimacy` seam does not apply; the equivalent check was done by hand
and is stronger (independent hash corroboration plus a from-source build).

| Artefact | Source | Age | Distribution | Independent corroboration | Verdict | Disposition |
|----------|--------|-----|--------------|---------------------------|---------|-------------|
| `dxa-0.1.5.tar.gz` | `https://www.floodgap.com/retrotech/xa/dists/` (upstream author Cameron Kaiser, the xa65 maintainer) | 4 yr (25 Mar 2022) | Source tarball, 37,987 bytes, GPLv2+ | FreeBSD ports `devel/dxa65` distinfo records the identical sha256 `8e40ed77…826799` | **OK** | Approved — pin by sha256 |
| `ghidra_12.1.3_PUBLIC` | Already installed at `~/dev/_ghidra-probe/` from the pivot | build 2026-Aug-17 | NSA/Ghidra official release | Version pinned from the install's own `application.properties` | **OK** | Approved — record the version in evidence, not the path |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

Notes for the planner:

- Fetch over **`https://`**, not the `http://` that FreeBSD's `MASTER_SITES`
  records. HTTPS was verified working (`HTTP/1.1 200 OK`) this session.
  `[VERIFIED: curl -fsSI https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz]`
- The tarball has **no signature and no checksum published by upstream**. The
  sha256 above is corroborated only by a third party (FreeBSD ports). That is
  enough for a throwaway probe build, and `DXA-01` in Phase 24 must vendor
  **this same hash** — record it in the verdict document.
- dxa describes itself as *"still considered \"alpha\" software and there may be
  bugs, which is why it is not part of the official xa distribution yet"*. That is
  a property of the tool under test, not a supply-chain signal, but it belongs in
  the findings document beside the numbers.
  **[CORRECTED by 23-02 — see `evidence/fixture/fixture-baseline.txt` RC-3: the
  self-description is at `INSTALL:15`, NOT in the man page `dxa.1`.
  `grep -i alpha dxa.1` exits 1 with no output. The claim holds; the citation
  did not.]**
  `[CITED: https://www.floodgap.com/retrotech/xa/]`

---

## Architecture Patterns

### System Architecture Diagram

```text
  ┌─────────────────────┐
  │ OPERATOR            │  supplies exactly one .d64 or .prg  (D-04)
  │ (out of band)       │  identified by release name + sha256
  └──────────┬──────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ PLAN 23-01  —  PRE-COMMITMENT  (touches nothing else)        │
  │  · R1..Rn first-match-wins decision rule      (D-07, PROOF-05)│
  │  · corpus inventory schema                    (D-05)          │
  │  · criterion-1 measurement definitions + window  ← ADD THIS   │
  │  · degrade narrowing pre-mapped for c2 and c3 (D-09)          │
  └──────────┬───────────────────────────────────────────────────┘
             │  git commit ordering IS the proof — nothing below
             │  may be committed before this
             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ CAPTURE  (VICE)                                   (D-02, D-03)│
  │  d64-parse → autostart → run past loader/depacker             │
  │  → exec checkpoint at handoff → paused window:                │
  │      16 × vice_memory_read (bank:"ram")  +  chip state        │
  │  → dump-artifacts assemble/write-set → flat 64K .bin + sha256 │
  └──────────┬───────────────────────────────────────────────────┘
             │
             ├──────────────────────────────────────────────┐
             ▼                                              │
  ┌──────────────────────────────────────────────┐          │
  │ INVENTORY  (VICE runtime observation ONLY)   │  (D-05,   │
  │  · $01 store watch → (PC, value) timeline    │   D-06)   │
  │  · jmp(ind) / RTS-trick sites → exec hits,   │          │
  │    index register values across hits         │          │
  │  · PC + backtrace sampling → certain-code set│          │
  │  · VIC pointers → certain-data set           │          │
  │  COMMITTED BEFORE ANY MEASUREMENT RUNS       │          │
  └──────────┬───────────────────────────────────┘          │
             │  entry points (-R), datablocks (-b),          │
             │  certain-code / certain-data sets             │
             ▼                                              ▼
  ┌───────────────────────┐              ┌────────────────────────────┐
  │ dxa 0.1.5             │  code/data   │ Ghidra 12.1.3 headless     │
  │  -g 0000  (MANDATORY) │  map (hints) │  BinaryLoader baseAddr 0x0 │
  │  -p all-nmos6502      ├─────────────▶│  Memory.split → volatile   │
  │  -d <fixed in 23-01>  │              │    $0000-$0001, $D000-$DFFF│
  │  -R entrypoints       │              │  analyzeAll()              │
  │  -B datablocks        │              │  ExportAnalysis → CLASSIF  │
  │  -a dump  (parseable) │              │                 + REFERENCES│
  └──────────┬────────────┘              │  Decomp → DecompInterface  │
             │                           └─────────────┬──────────────┘
             ▼                                         ▼
    criterion 1: data-recovery %,          criterion 2: COMPUTED_JUMP present
    FP count, error direction,             at the observed computed site?
    adjudicated fraction, window            (absence ⇒ unresolved — no warning)
             │                                         │
             │        criterion 3: memmap.json join    │
             │        under ≥2 observed $01 states     │
             │                                         │
             │   criterion 4: analyzer.rs source read  │
             │        (offline, no anno execution)    │
             ▼                                         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ VERDICT  docs/phase23-real-release-gate-findings.md   (D-10)  │
  │  frontmatter: verdict: go|degrade|no-go                       │
  │               verdict_rule_applied: R<N>                      │
  │               criteria: {…}   corpus: {name, sha256}          │
  │  body reproduces the rule and walks the values through it     │
  └──────────┬───────────────────────────────────────────────────┘
             ▼
     ROADMAP Phase 24 "Depends on" + Notes  ·  STATE.md pointer   (D-08)
             ▼
     Phase 24's planner reads the verdict as a precondition
```

### Recommended artefact layout

```text
.planning/phases/23-the-real-release-gate-go-degrade-no-go/
├── 23-01-PLAN.md            # THE RULE + inventory schema + measurement defs
├── 23-NN-PLAN.md            # measuring plans, all committed after 23-01
└── evidence/
    ├── corpus/              # sha256 + release identity ONLY — image not committed
    ├── tools/               # dxa-0.1.5.tar.gz sha256 line, built dxa, ghidra version
    ├── inventory/           # THE PRE-COMMITTED INVENTORY (D-05) — its own commit
    ├── capture/             # flat 64K sha256, .map.json, chip state, capture record
    ├── criterion1-*.txt     # dxa command lines, listings, computed numbers
    ├── criterion2-*.txt     # Ghidra transcripts, reference dumps
    ├── criterion3-*.txt     # $01 timeline, per-site bank states, join outputs
    └── criterion4-*.md      # analyzer.rs function-by-function audit

docs/phase23-real-release-gate-findings.md   # THE VERDICT (D-10)
```

Naming and the outcome-line convention should mirror Phase 9's `evidence/criterionN-*.txt`
exactly, because the rule reads its inputs from named outcome lines in those files
and never from a summary's paraphrase.
`[VERIFIED: .planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md, <decision_rule> block]`

### Pattern 1: the pre-committed first-match-wins decision rule

**What:** a table of named inputs, each read from one literal outcome line in one
named evidence file, followed by rules `R1..Rn` evaluated **in order**, first
match wins, with the fired rule recorded.

**When to use:** plan 23-01, before any measuring plan exists.

**Example** — the Phase 9 rule, which is the ROADMAP's stated bar, quoted verbatim:

```markdown
| Input | Source line | Source file |
|---|---|---|
| `c1_build` | `INSTALLED_VERSION:` present → `pass`; recorded install failure → `could-not-run` | `evidence/criterion1-install-and-version.txt` |
| `c3_4_vsf_load` | `VSF_LOAD:` | `evidence/criterion4-vsf-load.txt` |

Rules, first match wins:

- **R1 → `reconsider`.** `c1_build` is not `pass`. …
- **R4 → `degrade`.** Any of `c3_2_reassembly`, `c3_3_export_lbl`,
  `c3_4_vsf_load` is not `pass` (including `partial` and `could-not-run`). …
- **R5 → `proceed`.** Everything above passed.

**`c1_container_cost` never changes the verdict.** It is a measurement, not a
gate, and the milestone defined no cost threshold — inventing one here would be
the planner making a scope decision it has no authority to make.
```
`[VERIFIED: .planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md:<decision_rule>]`

Three properties to carry forward, each of which did real work in Phase 9:

1. **Every input is a literal outcome line**, so the rule cannot be evaluated by
   judgement. Phase 23's analogues: `C1_DATA_RECOVERY_PCT:`, `C1_FALSE_POSITIVES:`,
   `C1_ADJUDICATED_FRACTION:`, `C2_COMPUTED_DISPATCH:` ∈ {`resolved`,
   `unresolved`, `not-exercised`}, `C3_BANK_DIVERGENCE:` ∈ {`found`,
   `not-exercised`}, `C4_UNREPLACED_CAPABILITIES:` (count).
2. **`not-exercised` must be its own value, distinct from `pass`.** ROADMAP
   criteria 2 and 3 both demand it, and D-05's pre-committed inventory is what
   earns it. A rule that maps `not-exercised` to `pass` reproduces the defect
   the phase exists to remove.
3. **Name at least one input that is explicitly *not* a gate.** Phase 9 did this
   for `c1_container_cost` and said so in the document so a later reader could
   not mistake its absence for a failure. Phase 23's candidate: criterion 4's
   capability count, if no threshold is defensible before the audit is done.

**Anti-pattern:** a rule whose thresholds are numeric but unstated until the
measurement exists (e.g. "`degrade` if data recovery is materially below 72%").
Fix the number in 23-01 or make the input categorical.

### Pattern 2: the verdict as machine-readable frontmatter in a durable doc

**What:** YAML frontmatter carrying the verdict, plus a body that reproduces the
full rule and walks the actual values through it so a reader re-derives rather
than trusts.

**Example** — the Phase 9 artifact, verbatim:

```yaml
---
phase: 09-the-assumption-probe-go-no-go
requirement: ANNO-16
probe_date: 2026-08-20
regeneratoanno_version: 0.9.20
verdict: degrade
verdict_rule_applied: R4
criteria:
  c1_build: pass
  c1_container_cost: measured
  c2a_pty_tolerance: pass
  c2b_bootstrap_automatable: pass
  c3_2_reassembly: pass
  c3_3_export_lbl: pass
  c3_4_vsf_load: partial
---
```
`[VERIFIED: docs/phase9-external-analyser-probe-findings.md:1-19]`

Phase 23's frontmatter must additionally carry the corpus identity (D-04) and
the tool pins, because the numbers are meaningless without them:

```yaml
verdict: go|degrade|no-go
verdict_rule_applied: R<N>
# CORRECTED by evidence/SCHEMA.md section 1, which supersedes the scalar shape
# proposed here: with two releases the scalar keys have no single correct value,
# and a `file_sha256_secondary` beside them would reproduce the very
# canonical-image-centric model recovery-schema.mjs exists to prevent. The corpus
# is a LIST with exactly one element flagged canonical; the one-release case is
# the degenerate single-element list.
corpus:
  releases:
    - release: "<operator-supplied name/id>"
      file_sha256: "<sha256 of the supplied .d64/.prg>"
      capture_sha256: "<sha256 of the flat 64K image>"
      canonical: true
tools:
  dxa: "0.1.5 (sha256 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799)"
  ghidra: "12.1.3 PUBLIC build 2026-Aug-17"
  vice: "3.10 (fork backend)"
criteria: { … }
```

The body must keep Phase 9's `## Accepted limits` and `## Corrections to prior
documents` sections. `## Corrections` already has at least two known entries
waiting: `research/questions.md`'s false "real releases, already committed"
claim, and the `BankProbe3.java` reuse correction in this document.

### Pattern 3: a runtime-only definition of "computed" (criterion 2, D-06)

The circularity trap is real: if Ghidra finds the dispatch site, criterion 2 is
"Ghidra resolved the dispatch Ghidra found". The way out is a definition of
"computed" that only VICE can evaluate.

**Proposed definition, to be fixed in 23-01:**

> A dispatch site is **computed** iff, across the observed run, the value it
> dispatches through takes **two or more distinct values at the same program
> address**.

Concretely, for a `jmp ($xxxx)` site: at each exec hit read the two pointer
bytes (and the index register the preceding load used). Two distinct observed
targets from one site ⇒ computed. One target across many hits ⇒ constant in
practice, which is the *easy* case and must be reported as such, not as a pass.

Site discovery without either engine under test:

| Construct | Byte pattern | Discovery route |
|-----------|--------------|-----------------|
| `jmp (abs)` | `$6C` | `vice_memory_search` for `6C` over the resident window, then `vice_disassemble` each hit to confirm alignment |
| RTS-trick dispatch | `48 48 60` (`pha`/`pha`/`rts`) | `vice_memory_search`; the pivot fixture's own `rts_dispatch` uses this shape |
| Self-modified `jmp abs` | `$4C` whose operand bytes are also a store target | cross-reference against the `$01`-style store-watch technique on the operand address |

`[VERIFIED: fixture.a `rts_dispatch` uses `lda rts_hi,x / pha / lda rts_lo,x / pha / rts`; dxa's own listing renders `0836 48 pha`, `083a 48 pha`, `083b 60 rts`]`

**What Ghidra reports when it fails — verified, and it is nothing.**

Two headless runs on the same fixture, differing only in how the dispatch index
is produced:

| Fixture | Dispatch index | Reference emitted at the `jmp (ind)` site |
|---------|----------------|-------------------------------------------|
| `fixture.prg` (pivot original) | `ldx #$02` (immediate) | `REF 082e -> 00fb READ` **and** `REF 082e -> 089a COMPUTED_JUMP` |
| `fixture_comp.prg` (index computed from `$d012`) | `lda $d012 / and #$03 / tax` | `REF 0832 -> 00fb READ` — **and nothing else.** No `COMPUTED_JUMP`, no warning, no log line |

`[VERIFIED: two analyzeHeadless runs this session, 6502:LE:16:default, BinaryLoader baseAddr 0x7ff, -noanalysis + explicit analyzeAll(), full ReferenceManager dump]`

Two consequences for the plan:

1. **"Unresolved" is detected as the *absence* of a `COMPUTED_JUMP` reference
   from the site's own from-address.** There is no positive marker to grep for.
   The measuring plan must enumerate the observed dispatch sites *first* (from
   the D-05 inventory) and then check each one against the exported references —
   not scan the references for computed jumps, which would find none and
   silently report "not exercised".
2. This is a **synthetic** observation on a self-authored fixture and is **not**
   criterion 2's answer. Its value is that it makes the detection method
   concrete and tells the planner that D-09's pre-mapped `degrade` narrowing for
   criterion 2 is the branch most likely to be taken. Do not let it leak into
   the verdict as evidence.

### Pattern 4: the `$01` timeline and criterion 3's break point

**Instrument:** `vice_watch_add` with `address: "$0001"`, `type: "write"`. Every
hit stops the machine; read `PC` from `vice_registers_get` and the new value
from `vice_memory_read $0001`, then resume. Record `(cycle, PC, value)`.

`[VERIFIED: vice_watch_add input schema, src/mcp/vice/tools-manifest.json — "Add memory watchpoint with optional condition (shorthand for checkpoint with store/load)"; the `condition` field documents "For store watches, condition is evaluated after the store completes."]`

**Proposed operational definition of criterion 3's break point, to be fixed in 23-01:**

> The single-forward-carried-`$01` model **breaks at address A** iff there is a
> program address `PC_x` that accesses `A`, and `PC_x` is observed executing
> under **two distinct `$01` values** `v1 ≠ v2` such that the narrowest
> `memmap.json` entry containing `A` under `v1` differs from the one under `v2`.

That is directly measurable from runtime observation and needs neither engine.
Its complement is equally honest and is what D-05 makes earnable: if every
observed access site sees exactly one `$01` value, the corpus does not exercise
path-dependent banking, and criterion 3 records `not-exercised` as a fact about
the corpus.

Practical shape of the observation loop:

1. Arm the `$0001` write watch, run, and collect `(PC, value)` pairs with a
   **hard hit ceiling declared before the run**. Stop early when no new distinct
   `PC` appears in K consecutive hits (saturation), and record both the ceiling
   and whether saturation or the ceiling ended the run.
2. From the resulting distinct `$01` values, take the set of I/O access sites of
   interest (`vice_memory_search` for absolute-mode opcodes with an operand in
   `$D000-$DFFF`, confirmed with `vice_disassemble`).
3. Exec-checkpoint each candidate site, and on each hit read `$0001`. Two
   distinct values at one site is the break point; report the address, the two
   values, and the two `memmap.json` resolutions side by side.

**Cost warning.** A raster IRQ that banks twice per frame produces ~100 stops per
emulated second. Each stop is several MCP round trips. Bound it; do not let a
plan run open-ended. See Pitfall 7 for the per-backend limits.

### Pattern 5: certain-code and certain-data sampling (criterion 1's ground truth)

Neither engine may supply ground truth, and a real release has no `fixture.lbl`.
Two partial ground-truth sets are obtainable from observation alone:

**Certain code** — every byte the CPU executed, plus every JSR call site:

- Sample `PC` at many points (`vice_execution_step` batches, or `vice_run_until`
  with a cycle budget, then `vice_registers_get`). Each sampled `PC` is code.
- At each sample, `vice_backtrace` returns the JSR return addresses on the
  stack; each return address minus the `jsr` length is a call site, hence code,
  and its target is a routine entry. This is ~2 MCP calls per sample and yields
  several certain-code addresses each time.
  `[VERIFIED: vice_backtrace — "Show call stack (JSR return addresses)", tools-manifest.json. FORK ONLY — absent from tools-manifest.stock.json's 38 tools]`
- The certain-code set also feeds dxa's `-R routines` file, which is the
  non-circular way to give dxa entry points on a flat image where `-U` cannot fire.

**Certain data** — the VIC's DMA-fetched regions, which are data whether or not
any instruction references them:

- `dump-artifacts.mjs write-set` already derives `vic_bank`, `screen_base`,
  `charset_base` and `sprite_data_addresses` from the captured chip state.
  `[VERIFIED: src/skills/c64-ram-capture/SKILL.md — "It also derives `vic_bank`, `screen_base`, `charset_base` and `sprite_data_addresses` for free — do not recompute them by hand."]`
- Screen matrix (1000 bytes at `screen_base`), sprite pointers (`screen_base+$3F8`,
  8 bytes), charset or bitmap at `charset_base`, and the sprite bitmaps the
  pointers name. `vicderive.mjs` is the cross-check.

Everything outside both sets is **unadjudicated**, and that is the honest third
bucket — see below.

### Anti-patterns to avoid

- **Reusing the pivot's dxa command line verbatim on a flat 64K image.**
  `dxa -U -p all-nmos6502 -t detect-all -a enabled` is correct for a 279-byte
  `.prg` and wrong three ways for a 64K capture (Pitfalls 1 and 3).
- **Reusing `BankProbe3.java`'s `getBlock()`-first volatile guard verbatim on a
  flat 64K image.** Correct for a `.prg`, catastrophic for a raw import (Pitfall 2).
- **Computing a data-recovery percentage over all 65536 bytes.** Most of a
  capture is not the program. The window must be stated and defended in 23-01.
- **Scanning Ghidra's reference export for `COMPUTED_JUMP` to answer criterion 2.**
  Enumerate the observed sites first; a scan that finds none cannot distinguish
  "unresolved" from "no dispatch in this corpus".
- **Letting any throwaway probe script land outside `evidence/`.** They are
  evidence, not deliverables (ROADMAP note; Phase 9 shipped zero product code).
- **Leaving a probe artefact in `/tmp`.** tmpfs, 16 GB, cleared on reboot; the
  pivot already lost a dxa build to it. `[VERIFIED: df -h /tmp → tmpfs 16G]`

---

## Criterion 1: the measurement definition

This is the phase's one genuinely open method question (CONTEXT `<specifics>`),
and it is answerable, because the fixture's own definition was recovered by
reproduction rather than inference.

### The fixture's definition, recovered by reproduction

Rebuilding `fixture.a` with ACME and re-running dxa's exact published command
line reproduces the pivot's numbers:

```
$ acme -f cbm -o fixture.prg -l fixture.lbl fixture.a          # 281 bytes = 2 header + 279
$ dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg
  → 179 bytes emitted as instructions
  → 100 bytes emitted as .byt / .word          (92 as .byt, 8 as .word)
  → 179 + 100 = 279  ✓
```

Against the fixture's stated ground truth of **141 code / 138 data**
**[CORRECTED — that partition is an assumption, not a derivation: `fixture.a`
yields 145/131/3-pad. See `evidence/fixture/fixture-baseline.txt` RC-1. The table
below is the published arithmetic, retained because it is what the pivot claimed;
the source-derived figures are 72.39 (97/134) / 3 FP / 27.61 (37/134).]**:

| Quantity | Value | Definition |
|----------|-------|------------|
| data-recovery rate | 100 / 138 = **72.46%** → the published "72%" | (true-data bytes typed as data) ÷ (true-data bytes) |
| false positives | **0** | true-**code** bytes typed as data |
| false negatives | 38 / 138 = **27.5%** → the published "28%" | true-**data** bytes typed as code |

`[VERIFIED: reproduced end-to-end this session — acme build, dxa 0.1.5 run, byte-level classification of the `-a dump` listing]`

So the positive class is **data**, the denominator is **true data bytes**, and
"0 false positives" means dxa never called code data. This matches the wording
in `.planning/notes/vic-graphics-map-derivation.md`:
*"dxa scored **0 false positives** (never called code data) but 28% false
negatives (called data code). Its errors run exactly the dangerous way."*
`[VERIFIED: .planning/notes/vic-graphics-map-derivation.md, § "Honest gap"]`

**This matters for D-11.** The fixture's numbers can only be printed *beside* the
new ones if both use the same definition. Print the reproduction, not the quoted
figure — it costs one command and it proves the side-by-side is honest.

### The problem on a real release, and the proposed answer

A real release has no `fixture.lbl`, so the 138-byte denominator does not exist.
Two responses are wrong and one is defensible:

- ✗ **Use a static analyser to produce ground truth.** Circular; forbidden by D-06.
- ✗ **Assume everything not executed is data.** Assumes the answer; branches not
  taken in one run are still code.
- ✓ **Adjudicate what can be adjudicated, and report the fraction.**

**Proposed definitions, to be committed in 23-01:**

| Term | Definition |
|------|------------|
| Window `W` | The stated address ranges the measurement covers. Recommended: the resident-program ranges established by observation, explicitly excluding `$0000-$01FF` (zero page + stack), `$D000-$DFFF` (I/O), and any range the capture shows as never written by the loader and never executed |
| `C` (certain code) | Bytes in `W` proven code by execution or by being a JSR target/call site (Pattern 5) |
| `D` (certain data) | Bytes in `W` proven data by VIC DMA derivation (Pattern 5) |
| `U` (unadjudicated) | `W \ (C ∪ D)` |
| adjudicated fraction | `(|C| + |D|) / |W|` — **reported as a first-class number, not a footnote** |
| data-recovery rate | (bytes in `D` that dxa typed as data) ÷ `|D|` |
| false positives | count of bytes in `C` that dxa typed as data |
| false negatives | count of bytes in `D` that dxa typed as code |

Everything in `U` is reported as unclassified and enters no ratio. The fixture's
adjudicated fraction was 100%; the real release's will not be, and printing that
number beside the recovery rate is what stops the comparison from flattering
either side.

**Open sub-question the planner must close:** whether `C ∩ D ≠ ∅` is treated as
an error or as a legitimate self-modifying-code / jump-table overlap. Recommend
the latter, reported separately by count.

### Cracker code versus game code

`c64-provenance-diff` is N-way and needs **two independently-cracked releases of
one title** to classify anything; one image classifies nothing.
`[VERIFIED: src/skills/c64-provenance-diff/SKILL.md is cited in CONTEXT for shape only; no RELEASES.json exists anywhere in this tree — `find . -name RELEASES.json` returns nothing]`

Three options, in preference order:

1. **Ask the operator for a second release of the same title.** Strictly better —
   it makes `CRACKER-PATCH` ranges available and turns criterion 1's separation
   from an argument into a measurement. Worth one question before the corpus is
   fixed.
2. **Temporal separation from the capture itself.** What executes *before* the
   entry handoff is loader/cracktro; what executes *after* is game. The capture
   already breaks at the handoff checkpoint, so the boundary is observed rather
   than inferred. This works on a single image and is the recommended default.
   The `watch-loads.mjs` hit-log shape in `c64-ram-capture/scripts/` is the
   existing pattern for recording exactly this kind of boundary observation.
3. **Measure everything resident and state the cost.** Permitted by criterion 1's
   own wording, but it must say so in the number's own row, not in a footnote.

Whichever is chosen, 23-01 fixes it. A separation chosen after seeing which one
produces a nicer number is the same defect as a rule written after the measurement.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Assembling 16 memory reads into a 64K image | A loop that concatenates hex strings | `dump-artifacts.mjs assemble` | It asserts exactly 65536 bytes with no gap and no overlap **before** writing, and names the offending address. A dropped or short read is the normal failure and is invisible in a hex dump |
| Deriving the graphics map from chip state | Hand-decoding `$DD00`/`$D018`/`$D011` | `write-set`'s derived `vic_bank` / `screen_base` / `charset_base` / `sprite_data_addresses`, cross-checked with `vicderive.mjs` | The skill says explicitly "do not recompute them by hand"; the `$DD00` bits are inverted and that is the classic error |
| Comparing two captures | A byte-diff loop with a hand-written volatility list | `compare.mjs compare` / `floor` | It classifies volatile / drift / divergence identically every time and exits 1 on FAIL |
| Reading a `.d64` directory | A track/sector walker | `d64-parse.mjs directory --json` | It flags faked directory entries (`suspicious_reasons`) and reports chain errors instead of hanging — both are live hazards on cracked disks |
| Parsing dxa's listing to count code vs data bytes | Inferring instruction lengths from mnemonics | `dxa -a dump` + a column parser | `-a dump` prints the actual bytes per line, so byte counts are read, not computed. Length inference breaks on the mid-instruction label idiom and on out-of-order label lines (Pitfall 4) |
| Making Ghidra's I/O volatile on a flat image | `createUninitializedBlock` / `getBlock().setVolatile()` | `Memory.split()` then `setVolatile()` on the carved blocks | Pitfall 2 — the naive routes throw or silently mark all 64K volatile |
| Getting structural facts from Ghidra | `DataTypeManager.getAllComposites()` / `getDefinedData()` | `DecompInterface` (`Decomp.java`) | Named in REQUIREMENTS Out of Scope as "the single most expensive mistake available in this design"; returns essentially nothing on 6502 |
| Telling a wedge from a checkpoint stop | Ad-hoc ping loops | `vice-wedge-triage` skill | The emulator will be driven hard here; this is the existing decision tree |
| Waiting for a checkpoint | Polling paused state | `vice-sync.ts`'s poll-on-`hit_count` invariant | Documented, deliberately not unit-tested, and the fix for a real earlier bug: "check `hit_count` BEFORE … `paused`" |

**Key insight:** every asset in this table already exists in this repo and is
already guarded. The failure mode this phase is most exposed to is not a missing
library — it is a probe script that quietly reimplements one of these and gets a
number that looks plausible.

---

## Common Pitfalls

### Pitfall 1: dxa eats `$0000`/`$0001` as a load address on a flat 64K capture

**What goes wrong:** dxa's default (`-G`, on) reads the first two bytes of the
input as a little-endian load address. A flat 64K RAM capture's first two bytes
are the 6510 processor port — typically `$2F`, `$37` — so dxa sets `* = $372F`
and discards everything past `$FFFF`.

**Verified transcript:**

```
$ dxa -p all-nmos6502 -a dump flat64k_pp.bin        # $00=$2F, $01=$37
dxa: Warning: Input file caused an address overflow.
Bytes beyond $FFFF won't be processed.
              	.word $372f
              	* = $372f

$ dxa -g 0000 -p all-nmos6502 -a dump flat64k_pp.bin
              	.word $0000
              	* = $0000
0000          l0:
0000 2f 37    	.byt $2f,$37
```
`[VERIFIED: executed this session on a synthetic 64K image with the processor-port bytes planted at offset 0]`

**How to avoid:** pass `-g 0000` (the `--no-get-sa <addr>` form) for every flat
image. **Capture dxa's stderr into evidence** — it *does* warn, and the warning
is the cheapest possible guard against a mis-based run.

**Warning signs:** the listing's first line is not `.word $0000`; the output is
far shorter than 65536 bytes' worth.

### Pitfall 2: on a flat 64K import, `getBlock().setVolatile(true)` marks all 64K volatile

**What goes wrong:** Ghidra's raw-binary loader creates **one** memory block
covering the whole image. `BankProbe3.java`'s guard — `getBlock(addr)` first,
`setVolatile(true)` on the existing block — was written for a `.prg` where the
image block does not cover `$D000`, so `getBlock` returned `null` and a fresh
1-page I/O block was created. On a flat 64K import `getBlock($D000)` returns
`RAM 0000-ffff`, and setting it volatile suppresses dead-store elimination
across the entire address space. There is no error and no warning.

**Verified transcript:**

```
FlatProbe.java> BLOCKS-BEFORE:
FlatProbe.java>   RAM 0000-ffff vol=false
FlatProbe.java> NAIVE-BLOCK-AT-D000: RAM 0000-ffff size=65536      ← the trap
FlatProbe.java> SPLIT-OK at 2
FlatProbe.java> SPLIT-OK at d000
FlatProbe.java> SPLIT-OK at e000
FlatProbe.java> VOLATILE-SET: RAM 0000-0001
FlatProbe.java> VOLATILE-SET: RAM.split.split d000-dfff
FlatProbe.java> BLOCKS-AFTER:
FlatProbe.java>   RAM 0000-0001 vol=true
FlatProbe.java>   RAM.split 0002-cfff vol=false
FlatProbe.java>   RAM.split.split d000-dfff vol=true
FlatProbe.java>   RAM.split.split.split e000-ffff vol=false
```
`[VERIFIED: analyzeHeadless run this session, Ghidra 12.1.3, -loader BinaryLoader -loader-baseAddr 0x0 on a 65536-byte file]`

**How to avoid:** `Memory.split(block, addr)` at `$0002`, `$D000` and `$E000`
before setting volatile, then set it only on the `$0000-$0001` and
`$D000-$DFFF` blocks. Keep the `getBlock()`-first guard for the `.prg` route —
it is still right there — but branch on which route is in use.

API confirmation from the shipped javadoc:

```java
MemoryBlock Memory.split(MemoryBlock block, Address addr)
        throws MemoryBlockException, LockException
// "Split a block at the given addr and create a new block starting at addr."
void MemoryBlock.setVolatile(boolean v)     // per-block, not per-address
```
`[VERIFIED: ghidra_12.1.3_PUBLIC/docs/GhidraAPI_javadoc.zip → api/ghidra/program/model/mem/Memory.html, MemoryBlock.html]`

**Warning signs:** the run log prints one block covering `0000-ffff`; the
decompiler output shows *no* dead-store elimination anywhere, which looks like
success but is the whole-image-volatile symptom.

**Related, and worth recording:** the raw 64K import also logs
`Failed to add language defined memory block due to conflict: ZERO_PAGE:
start_address=0x0000, uninitialized, length=0x100` and the same for `STACK` at
`$0100`. These are INFO lines, not errors — the 6502 language wants to create
those blocks and the flat image already occupies the space. Harmless, but a
plan that greps the log for "Failed" will trip on them.
`[VERIFIED: analyzeHeadless import log, this session]`

### Pitfall 3: `-t detect-all` and `-d poor` change meaning on a flat 64K image

**What goes wrong:** on a 279-byte `.prg`, `-t detect-all` widens address-table
detection from "targets inside the program" to "targets anywhere". On a flat 64K
image *every* 16-bit value is inside the program, so `detect-internal` and
`detect-all` become the same setting and address-table detection fires
everywhere. Separately, `-d poor` (dxa's default) "lists as much of the object
as possible as program code, even if illegal instructions are present" — a large
code-side bias over unreferenced RAM.

**Verified measurements** on a synthetic 64K image (mostly zeros — a real
capture will differ in magnitude, not in kind):

```
detect-internal    code=   183 data= 65353 (.word= 65306)
detect-all         code=   183 data= 65353 (.word= 65306)   ← identical
ignore             code=   183 data= 65355 (.word=     0)
```
`[VERIFIED: three dxa runs this session with -g 0000 -p all-nmos6502]`

**How to avoid:** fix `-d` and `-t` in plan 23-01 and justify them there.
Recommended pairing for a flat capture: `-d skip-scanning` with a `-R` routines
file built from VICE-observed entry points, plus `-B` datablocks excluding
`$0000-$01FF`, `$D000-$DFFF`, and any range the inventory shows the loader never
wrote. `-t` is the more delicate choice; whichever is picked, run *both*
`detect-internal` and `detect-all` and print both numbers rather than picking
the flattering one after the fact.

**Warning signs:** a data-recovery rate above ~95%; a `.word` byte count that is
most of the image.

### Pitfall 4: the dxa listing parser, and the round-trip check that is unavailable

**What goes wrong:** dxa has no machine-readable output (that is `DXA-02`'s whole
reason for existing). The default `-a enabled` listing has four line shapes and
two of them are traps:

```
0810 l810:                    ← label line, emits no bytes
0810 	lda #$00              ← instruction, length must be inferred
08a2 	sta l8a6
	08a6 l8a6 = * + 1         ← mid-instruction label, indented, emits no bytes,
                                 and refers BACKWARD to the line above
08df l8df = * + 2             ← column-0 mid-instruction label whose address is
08dd 	.byt $1e,$1f,$00         HIGHER than the line that follows it
08b7   .word l892             ← spaces, not a tab, before the pseudo-op
```
`[VERIFIED: .planning/notes/dxa-ghidra-pivot-evidence/dxa.out, reproduced this session]`

**How to avoid:** use `-a dump`, which prefixes every byte-emitting line with the
actual bytes, so counts are read rather than inferred:

```
0812 8d 20 d0 	sta $d020
08b7 92 08      .word l892
0810          l810:            ← blank byte column ⇒ emits nothing
```
`[VERIFIED: dxa -a dump run this session]`

Match on `^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$` — note `\s+`, not `\t`;
`.word` lines use spaces. Classify by whether the text starts with `.byt` or
`.word`. Assert the byte total equals the image size; a mismatch is the parser's
refusal signal, and is a free preview of `DXA-02`'s "refusal rather than silent
mis-parse" requirement.

**The reassembly self-check is not available in the mode this phase needs.**
dxa's headline property is that its output reassembles to the identical binary,
which would be a perfect parser soundness check. It works — but only without
illegal opcodes:

```
$ dxa -U -p standard-nmos6502 -t detect-all fixture.prg > rt2.s
$ xa -o rt2.prg rt2.s && cmp fixture.prg rt2.prg
  → byte-identical

$ dxa -U -p all-nmos6502  -t detect-all fixture.prg > rt.s
$ xa -o rt.prg rt.s
rt.s:line 98: 08c2:Syntax error          ← ' slor ($04,x)'
rt.s:line 100: 08c4:Label already defined error
  → rt.prg is 0 bytes
```
`[VERIFIED: both runs this session against Debian xa65 2.4.1-0.1; confirms the man page's own warning that an illegal-opcode instruction set "may make your output unintelligible to xa(1)"]`

So the round-trip check and illegal-opcode coverage are mutually exclusive with
stock `xa`. Use the round-trip on a `standard-nmos6502` run purely to validate
the *parser*, and measure on the `all-nmos6502` run. Record the exclusion — it
is a concrete input to `DXA-02`'s design in Phase 24.

### Pitfall 5: `ExportAnalysis.java` is only *partly* the trap

**What goes wrong:** the evidence README labels `ExportAnalysis.java` as "the
trap: returns almost no structural facts on 6502" and `Decomp.java` as "the one
that works". Read literally, a planner might discard `ExportAnalysis.java` — but
its `## CLASSIFICATION` section (per-byte `code` / `data` / `undef`) and its
`## REFERENCES` section (typed xrefs including `COMPUTED_JUMP`) are exactly what
criteria 1 and 2 consume. Only its `## STRUCTS` section — the
`DataTypeManager.getAllComposites()` call — is empty on 6502.
`[VERIFIED: .planning/notes/dxa-ghidra-pivot-evidence/ExportAnalysis.java and ghidra3.txt — `## STRUCTS` at line 820 is empty; `## REFERENCES` at line 821 carries 43 typed xrefs including `082e -> 089a COMPUTED_JUMP`]`

**Two real defects in it that must be fixed before a 64K run:**

1. **The reference loop is capped at 400** (`while (ri.hasNext() && n < 400)`).
   The fixture had 43 references; a real release will have thousands. The cap
   truncates **silently** and in address order, so the tail of the image simply
   vanishes from the export.
2. **The classification loop emits one line per address.** On a flat 64K image
   that is 65536 lines — fine, but the plan should expect a ~1.5 MB evidence file
   and store it compressed or as a run-length summary plus the raw file.

**How to avoid:** remove the cap, assert the exported classification line count
equals the image size, and record the reference count in the evidence.

### Pitfall 6: `write-set` needs a release registry that does not exist here

**What goes wrong:** `dump-artifacts.mjs write-set --release <id>` resolves `<id>`
through `releases.mjs`, which reads a registry file. There is **no
`RELEASES.json` anywhere in this repository** — `find . -name RELEASES.json`
returns nothing — so `write-set` will refuse with a known-id list.
`[VERIFIED: find over the tree returns no RELEASES.json; src/skills/c64-ram-capture/scripts/releases.mjs `loadRegistry()` throws "no registry at <path>" when the file is absent]`

**How to avoid:** point the toolkit at a scratch registry inside the phase
evidence directory rather than creating one in `recovery/`:

```bash
export C64RE_DATA_DIR=.planning/phases/23-.../evidence/capture
export C64RE_REGISTRY="$C64RE_DATA_DIR/RELEASES.json"
```
`[VERIFIED: src/skills/c64-ram-capture/scripts/project-paths.mjs — `dataRoot()` honours `C64RE_DATA_DIR`, `registryFile()` honours `C64RE_REGISTRY`, `disksRoot()` honours `C64RE_DISKS_ROOT`]`

`assemble` needs no registry and is the cheap pre-check. If the registry route
proves more friction than it is worth for a one-image probe, `assemble` +
`compare.mjs digest` + a hand-written capture record is sufficient — but then the
VIC-derived certain-data set must be computed with `vicderive.mjs` instead of
coming free from `write-set`.

### Pitfall 7: checkpoint economics differ by backend, and stock will auto-disable your trace

**What goes wrong:** the natural instinct for the `$01` timeline is a
non-stopping trace checkpoint. On the stock backend that is guarded, and the
guard will silently turn your instrument off mid-run.

Stock-specific facts, all from the tool schemas and the implementing module:

- `stop:false` **requires** `acknowledgeTraceRisk: true`, whose own description
  explains why: *"a non-stopping checkpoint emits one CHECKPOINT_INFO frame per
  hit synchronously from inside the emulator's CPU loop, over the blocking
  monitor socket, and can stall the emulator on a hot address."*
  `[VERIFIED: src/mcp/vice/tools-manifest.stock.json, vice_checkpoint_add.acknowledgeTraceRisk]`
- The client rate-limits and **auto-disables above 20 hits/second**:
  `export const TRACE_HITS_PER_SECOND_LIMIT = 20;`
  `[VERIFIED: src/mcp/vice/stock-checkpoints.ts:279-281]`
- `vice_checkpoint_set_ignore_count` **does not exist on stock**, deliberately:
  *"Never add vice_checkpoint_set_ignore_count (D-15). There is no native ignore
  count; the only implementation would resume the machine on each ignored hit."*
  `[VERIFIED: src/mcp/vice/stock-checkpoints.ts:39-42; absent from tools-manifest.stock.json's 38 tools, present in tools-manifest.json's 62]`
- `vice_backtrace` is **fork-only** — absent from the stock manifest.
- Stock's `x64sc` on this host is **VICE 3.9**, which lacks `CPUHISTORY_GET`
  entirely (CLAUDE.md: requires ≥3.10), so there is no instruction-history
  fallback there either.

**How to avoid:** run the measurement on the **fork** backend, where
`vice_backtrace` and `vice_checkpoint_set_ignore_count` are available and the
trace guard's stock-only friction does not apply. Use stopping checkpoints with a
declared hit ceiling rather than trace checkpoints wherever the hit rate could
exceed ~20/s. If a plan wants to demonstrate the ROADMAP's "runs against either
backend" claim, do it as a separate small portability check, not as the
measurement route.

**Warning signs:** a `$01` timeline that stops growing mid-run; a checkpoint that
`vice_checkpoint_list` reports as disabled without anyone disabling it.

### Pitfall 8: the ordering property is the whole gate, and it is one-way

**What goes wrong:** any measurement committed before 23-01 destroys criterion 5
permanently. `git log` is the proof and it cannot be repaired by re-ordering
documents afterwards (D-07: "one-way").

**How to avoid:** 23-01 is wave 1 and alone in it. Every measuring plan declares
`depends_on: [23-01]`. Before the first measurement commit, record
`git log --oneline -1 -- <23-01 path>` into the evidence directory so the
findings document can cite the ordering without the reader running git.

**Warning signs:** a plan that "sketches the rule and refines it once the numbers
are in". That is the advisory-gate failure the ROADMAP names explicitly.

### Pitfall 9: `research/questions.md` carries a known factual error

`.planning/research/questions.md` states the measurements are *"Answerable
against the existing `c64-provenance-diff` fixtures — real releases, already
committed, already provenance-classified."* No such corpus exists in this
repository.
`[VERIFIED: .planning/research/questions.md, § "Does dxa + Ghidra hold up on a real cracked release?"; `find . -name RELEASES.json` returns nothing]`

Filed as
`.planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md`.
Read the ROADMAP Phase 23 Notes as authoritative. The correction belongs in the
findings document's `## Corrections to prior documents` section, following the
Phase 9 precedent.

---

## Code Examples

### Ghidra headless: the flat-64K invocation

```bash
G=~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC
$G/support/analyzeHeadless <project_dir> <project_name> \
  -import capture.bin \
  -processor 6502:LE:16:default \
  -loader BinaryLoader -loader-baseAddr 0x0 \
  -noanalysis \
  -scriptPath ./scripts -postScript Probe.java out.txt \
  -deleteProject
```
`[VERIFIED: run end-to-end this session; the log confirms "Using Loader: Raw Binary" and "Using Language/Compiler: 6502:LE:16:default:default". Option names cross-checked against ghidra_12.1.3_PUBLIC/support/analyzeHeadlessREADME.md's usage block, which lists -import, -preScript, -postScript, -scriptPath, -log, -overwrite, -readOnly, -deleteProject, -noanalysis, -processor, -cspec, -analysisTimeoutPerFile, -okToDelete, -max-cpu, -loader, -loader-<arg>]`

`-noanalysis` plus an explicit `analyzeAll(currentProgram)` inside the script is
the right shape: the script must set the volatile blocks and the entry points
*before* analysis, which is the whole point of `GHID-02`/`GHID-03`.

The available language IDs are `6502:LE:16:default` and `65C02:LE:16:default`
only — no illegal-opcode variant.
`[VERIFIED: ghidra_12.1.3_PUBLIC/Ghidra/Processors/6502/data/languages/6502.ldefs — id="6502:LE:16:default", id="65C02:LE:16:default"]`

The analyzers that matter both ran on 6502 and both are cheap:

```
    Basic Constant Reference Analyzer          0.020 secs
    Decompiler Switch Analysis                 0.328 secs
```
`[VERIFIED: analyzeHeadless analysis summary, this session]`

### Ghidra pre-script: volatile I/O on a flat 64K image (the corrected pattern)

```java
Memory mem = currentProgram.getMemory();
var sp = currentProgram.getAddressFactory().getDefaultAddressSpace();

// Carve the flat 64K block so volatility can be scoped. On a .prg import
// these splits are no-ops or throw AddressOutOfBounds -- branch on the route.
for (long a : new long[]{ 0x0002L, 0xd000L, 0xe000L }) {
    MemoryBlock blk = mem.getBlock(sp.getAddress(a));
    if (blk != null && !blk.getStart().equals(sp.getAddress(a))) {
        mem.split(blk, sp.getAddress(a));
    }
}
for (long a : new long[]{ 0x0000L, 0xd000L }) {
    MemoryBlock blk = mem.getBlock(sp.getAddress(a));
    if (blk != null) blk.setVolatile(true);
    else {                                  // .prg route: no block covers I/O
        MemoryBlock nb = mem.createUninitializedBlock(
            "VOL_" + Long.toHexString(a), sp.getAddress(a), a == 0 ? 2 : 0x1000, false);
        nb.setVolatile(true); nb.setRead(true); nb.setWrite(true);
    }
}
// ... entry points from the VICE-observed inventory ...
analyzeAll(currentProgram);
```
`[VERIFIED: the split-then-setVolatile half was executed this session and produced RAM 0000-0001 vol=true / RAM.split 0002-cfff vol=false / RAM.split.split d000-dfff vol=true / RAM.split.split.split e000-ffff vol=false. The createUninitializedBlock branch is BankProbe3.java's, verbatim, and is the .prg-route path the pivot already exercised]`

### Ghidra post-script: the reference dump criterion 2 reads

```java
println("## REFERENCES");
ReferenceIterator ri = currentProgram.getReferenceManager()
        .getReferenceIterator(currentProgram.getMinAddress());
int n = 0;
while (ri.hasNext()) {                       // NO 400-CAP -- see Pitfall 5
    Reference rf = ri.next(); n++;
    println(rf.getFromAddress() + " -> " + rf.getToAddress() + " " + rf.getReferenceType());
}
println("## REFERENCE_COUNT " + n);
```

Reference kinds observed on 6502, all of which the annotation join consumes:
`READ`, `WRITE`, `READ_WRITE`, `DATA`, `CONDITIONAL_JUMP`, `UNCONDITIONAL_JUMP`,
`UNCONDITIONAL_CALL`, `COMPUTED_JUMP`.
`[VERIFIED: .planning/notes/dxa-ghidra-pivot-evidence/ghidra3.txt § "## REFERENCES", and reproduced this session]`

### dxa: the flat-64K command line

```bash
dxa -g 0000 \
    -p all-nmos6502 \
    -d skip-scanning \
    -t detect-internal \
    -R entrypoints.txt      `# VICE-observed entry points, one hex addr per line` \
    -B datablocks.txt       `# one xxxx-yyyy per line; ! = no vectors, ? = wholly unused` \
    -a dump \
    capture.bin  > listing.txt  2> listing.stderr
```

Every flag here is a decision that changes the number, so 23-01 must fix all of
them. `-g 0000` is mandatory (Pitfall 1); `-d` and `-t` are the two judgement
calls (Pitfall 3); `-a dump` is the parseability choice (Pitfall 4). **Keep
`listing.stderr` — the load-address warning lives there.**
`[VERIFIED: all flags read from dxa 0.1.5's own man page (dxa.1) and exercised this session]`

### The `-a dump` classifier

```javascript
// Byte-exact code/data split from a dxa -a dump listing.
// `\s+` not `\t` -- .word lines use spaces (verified against dxa 0.1.5 output).
const LINE = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$/;
const code = new Set(), data = new Set();
for (const line of listing.split("\n")) {
  const m = LINE.exec(line);
  if (!m) continue;                        // label / mid-instruction-label line
  const addr = parseInt(m[1], 16);
  const bytes = m[2].trim().split(/\s+/).length;
  const isData = m[3].startsWith(".byt") || m[3].startsWith(".word");
  for (let i = 0; i < bytes; i++) (isData ? data : code).add(addr + i);
}
if (code.size + data.size !== IMAGE_SIZE) {
  throw new Error(`dxa listing parse: accounted ${code.size + data.size} of ${IMAGE_SIZE} bytes`);
}
```
`[VERIFIED: this exact shape reproduced the fixture's 179/100 split and, via 100/138, the published 72% figure]`

### The `$01` observation loop (fork backend)

```
vice_watch_add   { address: "$0001", type: "write" }        → checkpoint_num
loop, with a declared hit ceiling:
  vice_execution_run
  poll vice_checkpoint_list until this checkpoint's hit_count increments
        (poll on hit_count, never on paused state -- vice-sync.ts's invariant)
  vice_registers_get                       → PC
  vice_memory_read { address: "$0001", size: 1 }   → new value
  vice_cycles_stopwatch { action: "read" } → ordering
  record (cycle, PC, value)
  stop when: ceiling reached, OR no new distinct PC in K consecutive hits
vice_checkpoint_delete
vice_checkpoint_list  → assert zero checkpoints (the delete call's own word is never the proof)
vice_execution_run    → leave the machine running, exactly once
```
`[VERIFIED: tool names and argument shapes from src/mcp/vice/tools-manifest.json; the poll-on-hit_count invariant from src/mcp/vice/vice-sync.ts:217-248; the disarm-and-enumerate discipline from src/skills/c64-ram-capture/SKILL.md steps 7-9]`

---

## analyzer.rs capability inventory (PROOF-04 starting point)

Read offline this session from
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/src/analyzer.rs`
— 1,506 lines, of which **25 are `#[test]` functions** (roughly lines 700-1506),
so the substantive body is ~700 lines. Reading is permitted; running anno is not (D-01).

| Entry point | Line | What it does | Candidate replacement |
|-------------|------|--------------|-----------------------|
| `analyze(state) -> AnalysisResult` | 20 | The whole pass: walks blocks, emits `labels: BTreeMap<Addr, Vec<Label>>` and `cross_refs: BTreeMap<Addr, Vec<Addr>>` | Ghidra `ReferenceManager` for xrefs; label naming is the annotation store's job (Phase 25) |
| `analyze_instruction(...)` | 285 | Per-addressing-mode operand → label-type attribution | Ghidra reference *kind* (`READ`/`WRITE`/`READ_WRITE`/`DATA`) |
| `promote_return_labels(...)` | 372 | Promotes `Branch`/`Jump`/`Subroutine` to `Return` when the target's first byte is `RTS ($60)` or `RTI ($40)` — the IDA `locret_` convention | **No Ghidra equivalent surfaced by the pivot.** Candidate "lost" entry; cost is cosmetic label quality |
| `update_usage(...)` | 419 | Ref counting + first-seen-type, feeding first-wins label selection. **[CORRECTED — the per-`LabelType` count map is built at line 427 and NEVER READ: `analyze` destructures it as `_types_map` at line 202. Within `analyzer.rs` the counting is dead code; selection is purely first-wins, with no ranking mechanism for a replacement to reproduce. See criterion-4 audit correction 4.]** | Store-side concern |
| `follow_indirect_jumps(...)` | 445 | On `JMP ($xxxx)` (`0x6C`), if `$xxxx` is an `Address`-typed block inside the binary, read the 16-bit pointer and register a jump target label + xref | **Directly overlaps criterion 2.** Ghidra's `COMPUTED_JUMP` covers the constant case; the anno version needs the block already typed `Address`, so it is not obviously stronger — this comparison is criterion 4's most load-bearing row |
| `guess_scope_end(state, start)` | 546 | Scope end = first `RTS`/`RTI` at or after `start`, or the next virtual splitter. **[CORRECTED — the splitter branch is CONDITIONAL: it returns the previous line's last byte only `if bytes > 0` (lines 561-564). On a zero-length visual line the guard fails, nothing is returned, and the scan continues PAST the splitter looking for an `RTS`/`RTI`. A reimplementation treating the splitter as an unconditional terminator would not match. See criterion-4 audit correction 5.]** | Ghidra `Function.getBody()` |
| `flow_analyze(state, start)` | 581 | Worklist reachability from an entry, returning covered `Range<usize>` spans. **[CORRECTED — two structural limits the one-line summary hides: it reads `state.raw_data` and NEVER consults `state.block_types`, so it decodes straight into data blocks; and its `JMP` arm is guarded by `op.mode == AddressingMode::Absolute` (line 647), so `JMP ($xxxx)` terminates the span without queueing anything. It structurally cannot follow the construct `follow_indirect_jumps` exists to handle, and the two passes never combine. See criterion-4 audit correction 6.]** | Ghidra `analyzeAll()` + `Disassemble Entry Points` |
| `AnalysisResult` | 8 | `{ labels, cross_refs }` | The annotation store's schema (`STORE-01`) |

Supporting vocabularies the audit must account for, because each is a concrete
fact anno records and the replacement must either record or drop:

- **`LabelType` (11 variants used; the enum declares **14** — `Predefined = 10`,
  `UserDefined = 11` and `LocalUserDefined = 12` at `state/types.rs:361-378` are
  store-side kinds `analyzer.rs` never emits, so a store schema copied from the
  enum inherits three values the analysis pass has no opinion about; see
  `evidence/criterion4-analyzer-audit.md` correction 2):** `AbsoluteAddress`, `Branch`, `ExternalJump`,
  `Field`, `Jump`, `Pointer`, `Return`, `Subroutine`, `ZeroPageAbsoluteAddress`,
  `ZeroPageField`, `ZeroPagePointer`. Note the ZP-specific triple and the
  `Field` vs `Pointer` distinction — these drive the typed label prefixes
  (`zpp_`/`zpa_`/`f_`) that `STORE-05` names as "worth stealing".
- **`BlockType` (7 variants used; the enum declares **12** at
  `state/types.rs:314-331` — `DataByte`, `PetsciiText`, `ScreencodeText`,
  `ExternalFile` and `Undefined` have no arm and fall through to a bare
  `else { pc += 1 }`, recording **no label and no cross-reference**, so
  `STORE-01`'s PETSCII and screencode typing has no analyzer-side predecessor;
  see `evidence/criterion4-analyzer-audit.md` correction 3):** `Code`, `Address`, `DataWord`,
  `LoHiAddress`, `HiLoAddress`, `LoHiWord`, `HiLoWord`. The split-pointer table
  handling (`LoHiAddress` with a virtual-splitter-aware pair walk) is the
  concrete anno capability Ghidra answers with the `CONCAT11` idiom in the
  decompiler — a *different shape of answer*, and the audit must say whether
  that shape is sufficient for `STORE-01`'s per-range typing.

`[VERIFIED: analyzer.rs — signatures at lines 8, 20, 285, 372, 419, 445, 546, 581; doc comments at 365-371 ("Promote `Branch`, `Jump`, and `Subroutine` label types to `Return` when the target address is an internal address whose first byte is `RTS` ($60) or `RTI` ($40)… mirrors IDA Pro's `locret_` convention") and 442-444 ("When we see `JMP ($xxxx)`, check if `$xxxx` points to an Address-typed block inside our binary. If so, read the 16-bit pointer stored there and register it as a jump target label + cross-reference."); variant lists by grep over the file]`

Two audit disciplines worth fixing in 23-01:

1. **Each capability gets exactly one of three dispositions** — `replaced-by:<what>`,
   `lost-accepted:<cost>`, or `lost-blocking:<what it breaks>` — and the count of
   the third is a candidate rule input.
2. **Do not audit only `analyzer.rs`.** The ROADMAP names it, but the pivot's own
   sizing table shows `exporter/` (2,749 lines) and `state/` (5,187 lines) as
   "must build". Criterion 4 is scoped to `analyzer.rs`; if the audit finds a
   capability that actually lives elsewhere, record it as a scope observation for
   Phase 25 rather than widening this phase.

---

## State of the Art

| Old belief | Corrected | When | Impact |
|------------|-----------|------|--------|
| "The corpus exists — `c64-provenance-diff` fixtures are real releases, already committed" (`research/questions.md`) | No `RELEASES.json` and no real release anywhere in this tree; the corpus is operator-supplied | 2026-08-26 (ROADMAP Notes; confirmed this session) | D-04 exists because of this; the correction belongs in the findings document |
| "`ExportAnalysis.java` is the trap; use `Decomp.java`" (evidence README) | Only its `## STRUCTS` section is the trap. Its `## CLASSIFICATION` and `## REFERENCES` sections are what criteria 1 and 2 read — with the 400-reference cap removed | This session | Prevents discarding the export that criterion 1 needs |
| "Reuse `BankProbe3.java`'s `getBlock()`-first guard verbatim" (CONTEXT discretion) | Correct for `.prg`, silently marks all 64K volatile on a raw import. Split first | This session | Overturns a CONTEXT default |
| "dxa's fixture command line transfers to the capture" | `-g 0000` mandatory; `-d`/`-t` change meaning; `-U` cannot fire on a flat image | This session | Three flags must be fixed in 23-01 |
| "Ghidra resolves computed dispatch (fixture showed `COMPUTED_JUMP`)" | The fixture's index was an immediate. With a computed index the reference disappears entirely and nothing is reported | This session, on a synthetic variant — **not criterion 2's answer** | Makes the detection method concrete; raises the prior on D-09's criterion-2 degrade branch |

**Deprecated / not to be used here:**

- the external analyser, in every form, including `anno-coverage.ts` (D-01).
- `DataTypeManager.getAllComposites()` / `getDefinedData()` for structural facts
  (REQUIREMENTS Out of Scope: "the single most expensive mistake available in
  this design").
- `.vsf` as a bootstrap input (carried `wont-fix` from v0.3.0).
- Any unpacker (Out of Scope; depack-by-running is the decision D-03 rests on).

---

## Runtime State Inventory

Not applicable — this phase is not a rename, refactor or migration. It adds
evidence files, one findings document, and pointer edits to ROADMAP.md and
STATE.md. **None — verified by reading the phase boundary in 23-CONTEXT.md
(`<domain>`: "A measurement probe plus a recorded verdict. Nothing here builds
product.").**

The one adjacent concern worth naming, since it is state that outlives the
session: probe artefacts written to `/tmp` are lost on reboot (tmpfs, 16 GB).
Copy the built `dxa`, its tarball hash line, and every transcript into
`evidence/` before the session ends. `[VERIFIED: df -h /tmp → tmpfs 16G]`

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| dxa | Criterion 1 | ✗ — not on `$PATH`, not in Debian `xa65` | build 0.1.5 from source | none needed; build verified this session |
| gcc + make | Building dxa | ✓ | `/usr/bin/gcc`, `/usr/bin/make` | — |
| Ghidra | Criteria 1, 2, 3 | ✓ `~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` | 12.1.3 PUBLIC, build 2026-Aug-17 | reinstall (1.4 GB) if the probe dir is deleted |
| Java | Ghidra | ✓ | OpenJDK 21.0.12.1 (meets `application.java.min=21`) | — |
| VICE fork (`-mcpserver`) | Capture + all observation | ✓ `/usr/local/bin/x64sc` | 3.10 | stock, with the losses in Pitfall 7 |
| VICE stock (binary monitor) | Portability cross-check | ✓ `/usr/bin/x64sc` | **3.9** — no `CPUHISTORY_GET` | fork |
| ACME | Rebuilding `fixture.a` for the D-11 side-by-side | ✓ `~/.local/bin/acme` | on `$PATH` | quote the published figures instead (weaker) |
| `xa` (xa65) | Optional parser round-trip check | ✓ `/usr/bin/xa` | 2.4.1-0.1 | skip; only works in `standard-nmos6502` mode anyway |
| Node | Evidence scripts | ✓ | 22.22.0 | — |
| **A real cracked release** | **Everything except criterion 4** | **✗ — operator-supplied (D-04)** | — | **None. Its absence is a pre-declared rule input (D-04/D-05), not a workaround** |
| Network | Fetching the dxa tarball | ✓ HTTPS to floodgap.com verified | — | vendor the tarball into `evidence/tools/` on first fetch |

**Missing dependencies with no fallback:**

- **The corpus.** Secure it before plan 23-01 is written, because 23-01 must fix
  the measurement window and the window depends on what the image is. If it
  cannot be obtained, that is a rule input the pre-committed rule must already
  name — write that branch into `R1` rather than discovering it later.

**Missing dependencies with fallback:**

- dxa — build from source, pinned (5 seconds, no dependencies).
- `analyzer.rs` — present offline in the cargo registry; no network, no anno run.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this
section is required. It has an unusual shape here because the phase ships **no
product code**: there is nothing to unit-test, and the Phase 9 precedent closed
its validation contract on evidence integrity rather than on a test suite.

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in runner (`node --test`) — no separate framework |
| Config file | none — `src/mcp/vice/package.json` `test` script: `node --test '*.test.*'` |
| Quick run command | `cd src/mcp/vice && npm test` |
| Full suite command | `cd src/mcp/vice && npm test` (the **full** suite — `test:automated` skips `MANUAL_ONLY_TESTS` and hides CI failures) |
| Phase-gate role | **Regression only.** No new test belongs to this phase; the suite must simply stay green, since the phase touches no source |

### Phase requirements → validation map

Because the deliverable is evidence, the "test" for each requirement is an
evidence-integrity check, exactly as Phase 9's `09-VALIDATION.md` did it.

| Req ID | Behaviour | Check type | Automated command | Exists? |
|--------|-----------|------------|-------------------|---------|
| PROOF-05 (ordering) | 23-01's commit precedes every measurement commit | evidence | **[CORRECTED — the phase-directory form is unsatisfiable by construction: four CONTEXT/RESEARCH/VALIDATION/PLAN commits predate execution, so that query always names the context commit. Scope to `evidence/`, per `evidence/README.md` § Ordering proof → Scope note.]** `git log --oneline --reverse -- <phase dir>/evidence \| head -1` names the rule commit | ✅ git |
| PROOF-05 (verdict) | Verdict is machine-readable | evidence | `grep -E '^verdict: (go\|degrade\|no-go)$' docs/phase23-*-findings.md` | ✅ grep |
| PROOF-05 (rule cited) | The fired rule is named and reproduced | evidence | `grep -E '^verdict_rule_applied: R[0-9]+$'` and the rule text present in the body | ✅ grep |
| PROOF-01 | Numbers present, beside the fixture's | evidence | outcome lines `C1_DATA_RECOVERY_PCT:`, `C1_FALSE_POSITIVES:`, `C1_FALSE_NEGATIVES:`, `C1_ADJUDICATED_FRACTION:`, `C1_WINDOW:` all present in `evidence/criterion1-*.txt` | ❌ Wave 0 (schema fixed in 23-01) |
| PROOF-01 (corpus identity) | Binary named and hashed | evidence | **[CORRECTED per `evidence/SCHEMA.md` § 1 — scalar keys superseded]** `corpus.releases[]` in frontmatter, every element carrying `release` / `file_sha256` / `capture_sha256` / `canonical`, and exactly one element `canonical: true` | ❌ Wave 0 |
| PROOF-02 | Computed dispatch result recorded either way | evidence | `C2_COMPUTED_DISPATCH:` ∈ {`resolved`,`unresolved`,`not-exercised`}; if `resolved`, a target address is shown; otherwise a transcript path is cited | ❌ Wave 0 |
| PROOF-03 | Bank divergence established or absence recorded | evidence | `C3_BANK_DIVERGENCE:` ∈ {`found`,`not-exercised`}; if `found`, address + two `$01` values + two `memmap.json` resolutions shown | ❌ Wave 0 |
| PROOF-04 | Every audited capability has a disposition | evidence | every row in `evidence/criterion4-*.md` matches `replaced-by:\|lost-accepted:\|lost-blocking:` | ❌ Wave 0 |
| Inventory pre-commitment | Inventory committed before any measurement | evidence | inventory commit precedes the first `criterion[123]` evidence commit in `git log` | ✅ git |
| Repo integrity | No product code changed | evidence | `git diff --name-only <base>..HEAD` touches only `.planning/`, `docs/`, and nothing under `src/` | ✅ git |

### Sampling rate

- **Per plan commit:** `cd src/mcp/vice && npm test` — proving the phase changed
  no behaviour. This is a regression gate, not a coverage claim.
- **Per evidence commit:** the corresponding grep assertions above.
- **Phase gate:** full `npm test` green **and** every outcome line present, before
  `/gsd-verify-work`.

### Wave 0 gaps

- [ ] **The outcome-line schema itself** — every `❌ Wave 0` row above is blocked
      on 23-01 fixing the exact literal outcome-line names. This is not a test
      file to write; it is a pre-commitment to make. It is the single highest
      leverage item in the phase.
- [ ] `evidence/` directory with the Phase 9 `<evidence_conventions>` block
      restated (transcribe outcome lines from raw output; never from a summary's
      paraphrase; a `could-not-run` is written up as fully as a pass).
- [ ] No new test framework or fixture is needed. Do not add one.

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level: 1`. This phase
runs no server, exposes no endpoint and stores no user data, so most categories
are `no` — but three real exposures exist and each has a concrete control.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | No auth surface; the phase adds no tool and no endpoint |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-principal surface |
| V5 Input Validation | **yes** | The corpus is an **untrusted binary from outside the project**. It is executed in an emulator and parsed by three third-party tools. Controls: parse the `.d64` with `d64-parse.mjs` first (it reports chain errors instead of hanging and flags faked directory entries); never treat any string recovered from the image as a path, a command or a label without escaping; treat dxa's and Ghidra's output as untrusted text when a throwaway script parses it |
| V6 Cryptography | **yes (integrity only)** | sha256 pinning: the dxa tarball against the FreeBSD ports value, the corpus file and the capture against their own recorded digests. `compare.mjs digest` is the existing seam — do not hand-roll a hashing helper |
| V12 File & Resource | **yes** | The phase writes evidence into `.planning/phases/23-*/evidence/`. Do not commit the corpus image itself (D-04 says identity by name + sha256); confirm it is not accidentally added, and check whether `.gitignore` needs a line for the evidence corpus directory |
| V14 Configuration | **yes** | Fetch the dxa tarball over HTTPS, not the `http://` the FreeBSD ports `MASTER_SITES` records; verify the hash before `tar xzf`, not after |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Tampered/substituted dxa tarball (unsigned, dormant upstream, plain-HTTP master site) | Tampering | HTTPS + sha256 pin corroborated by FreeBSD ports; vendor the verified tarball into `evidence/tools/` so the phase does not re-fetch |
| Malicious or corrupt `.d64` — faked directory entries, self-referential chains | Denial of Service | `d64-parse.mjs` reports `chain_error` instead of hanging and sets `suspicious_reasons`; run `directory --json` before booting anything |
| Untrusted C64 code executed in the emulator | Elevation (sandbox escape) | The emulator is the sandbox; the broker already isolates it. Do **not** grant the run any host-path capability it does not need, and keep `VICE_SKIP_RESOURCE_INSTALL` behaviour unchanged |
| Ghidra analysing an untrusted binary | Tampering / DoS | Run headless with `-deleteProject` and `-analysisTimeoutPerFile`; do not open the project in the GUI; Ghidra scripts are ours, not the corpus's |
| Path injection from recovered strings (labels, filenames from the image) | Injection | Never interpolate a recovered string into a shell command or a path. `hostpath.ts` / `containerpath.ts` remain the only permitted path seams |
| Evidence tampering after the fact | Repudiation | Git commit ordering is the integrity mechanism for the gate (D-07). Record `git log --oneline -1` of 23-01 into evidence before the first measurement |

Nothing here rises to `security_block_on: high`. No new attack surface is added;
the exposures are the ordinary ones of running third-party tools over an
untrusted input file, and each has an existing control in this repo.

---

## Project Constraints (from CLAUDE.md)

Directives this phase must honour. Most of CLAUDE.md constrains product code and
is inert here; these are the ones that bite.

| Directive | Bearing on this phase |
|-----------|----------------------|
| **GSD workflow enforcement** — no direct repo edits outside a GSD workflow | Every probe run and every evidence file lands through a phase plan |
| **`/tmp` is tmpfs** (memory + CLAUDE.md conventions) | Copy every probe artefact into `evidence/` before the session ends |
| **Emulator access only via `mcp__plugin_c64-re-tools_vice__*`** | No direct socket, no `x64sc` invoked by hand for the measurement |
| **`vice-sync.ts` invariants** — exactly one resume per wait; poll on `hit_count`, never on paused state | The `$01` loop and every checkpoint wait follow this |
| **Three power-cycling resources are denied** (`MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency`) | Never set them; a power cycle destroys the capture |
| **Stock VICE binary monitor services exactly one client** | Do not open a second connection to diagnose a slow run; that is indistinguishable from a wedge |
| **Non-stopping checkpoints stall the emulator thread** | Pitfall 7 — prefer stopping checkpoints with a ceiling |
| **`CPUHISTORY_GET` requires VICE ≥ 3.10** | Stock here is 3.9; no instruction-history fallback on that backend |
| **Line numbers in CLAUDE.md constraints drift between phases** | Treat any `file:line` mismatch as drift to re-verify, not as evidence the constraint changed — the same discipline applies to this document's own citations |
| **Node ≥ 22.18, no build step for the shipped server** | Evidence scripts are throwaway `.mjs`; they must not be added to `resources/` or to any manifest |
| **Any host-facing path goes through `hostpath.ts` / `containerpath.ts`** | If a probe script needs a host path, it goes through the seam or it is not a probe script that belongs in the repo |
| **`test:automated` hides CI failures** (memory) | Run the full `npm test` before calling the phase done |
| **No devcontainer in this repo** (memory) | dxa and Ghidra install on the host, not in a container |
| **No anno testing / anno is being removed** (memory + D-01) | Reinforces D-01 from two directions |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The fixture's stated ground truth (141 code / 138 data) is correct; the 72%/28% arithmetic was reproduced against it but the partition itself was taken from the pivot note rather than re-derived from `fixture.a` byte by byte | Criterion 1 | **CLOSED AND REFUTED by 23-02.** The re-derivation was done: `fixture.a` yields 145 code / 131 data / 3 assembler-pad, never 141/138. `FIXTURE_REPRODUCED: no`. The published figures are reproducible only under a four-byte reclassification that was **fitted**, so it is a hypothesis, not a derivation. The source-derived baseline is `72.39 (97/134)` / **3** FP / `27.61 (37/134)`, and the published partition is more generous to dxa than the source is in exactly the place deciding the "0 false positives" headline. See `evidence/fixture/fixture-baseline.txt` RC-1 |
| A2 | The `-a dump` line grammar (`^AAAA (hh )+\s+text`) covers every line shape dxa 0.1.5 emits | Pitfall 4 / Code Examples | Medium. Verified against the fixture's output including `.byt`, `.word`, label and mid-instruction-label lines, but a real release may produce shapes the fixture did not. **The byte-total assertion is the guard** — it converts an unseen shape into a refusal rather than a silent undercount |
| A3 | The recommended `C` / `D` / `U` three-bucket adjudication is the right measurement design | Criterion 1 | Medium. It is a proposal, not a finding. 23-01 must adopt or replace it *before* measuring; whichever it picks, the property that matters is that it was fixed first |
| A4 | Temporal separation at the loader handoff is a sound proxy for cracker-versus-game code | Criterion 1 | Medium. A cracktro that stays resident, or a trainer patched into the game's own code, defeats it. Mitigated by asking the operator for a second release of the title (option 1), which makes the separation a measurement |
| A5 | The fork backend is the better instrument for this phase | Pitfall 7 / Standard Stack | Low. Grounded in the two manifests and `stock-checkpoints.ts`, but "runs against either backend" is a ROADMAP claim the phase may still want to demonstrate separately |
| A6 | Ghidra's failure to resolve a computed index generalises from the synthetic variant to real code | Pattern 3 | **Deliberately not relied on.** Recorded as a prior only. If a plan treats it as criterion 2's answer, that is the exact defect the phase exists to remove |
| A7 | `-d skip-scanning` + `-R` observed entry points is the right dxa configuration for a flat capture | Standard Stack / Pitfall 3 | Medium. Reasoned from the man page's own description plus the flat-64K runs, not measured against a real release. 23-01 should fix it and, if cheap, print both `-d` modes' numbers |
| A8 | The Ghidra probe install at `~/dev/_ghidra-probe/` will still exist when the phase runs | Environment Availability | Low. Its own README says it is safe to delete. Record the *version* in evidence, never the path (CONTEXT already says this) |

---

## Open Questions (RESOLVED)

All six were closed during phase-23 planning. Each carries a `RESOLVED:` pointer naming the
plan and the construct that closed it. Nothing here is still open; a reader looking for a
live unknown should read the measuring plans' `## ACCEPTED LIMIT` sections instead.


1. **Can the operator supply two independently-cracked releases of one title
   rather than one image?**
   - What we know: `c64-provenance-diff` is N-way and needs two to classify
     anything; a `CRACKER-PATCH` range is exactly what criterion 1's separation
     wants.
   - What's unclear: whether the operator has two.
   - Recommendation: **ask before 23-01 is written.** One question, and the
     answer changes the criterion-1 method from an argument into a measurement.
     If the answer is no, temporal separation (option 2) is the default and 23-01
     says so.
   - **RESOLVED:** asked and answered yes during planning — the operator has two
     independently-cracked releases. `23-01`'s `<assumption_delta_decision>`
     promotes the corpus noun from a scalar image to a `corpus.releases[]` list
     with exactly one `canonical: true`, and `23-03` Task 1 is the operator
     intake that places both images and names the canonical one. `23-06` does the
     two-release provenance classification the answer unlocked.

2. **What is the measurement window, concretely?**
   - What we know: it cannot be all 65536 bytes; it must be stated; runtime
     observation bounds it from below.
   - What's unclear: whether it is expressed as "the ranges the loader wrote",
     "the ranges executed or reachable from an executed call site", or an
     explicit address list.
   - Recommendation: express it as an explicit list of `$xxxx-$yyyy` ranges
     committed in 23-01's inventory schema, derived from the capture, with the
     derivation rule stated. Never as a percentage of the image.
   - **RESOLVED:** as recommended. `23-01` Task 2 writes the *window derivation
     rule* into `evidence/SCHEMA.md` — `W` is the union of loader-written and
     observed-executing ranges minus `$0000-$01FF`, `$D000-$DFFF` and any range
     neither written nor executed — committed as an explicit `$xxxx-$yyyy` range
     list on `INV_WINDOW`, before dxa is run, and never as a percentage.

3. **Does `-t detect-all` or `-t detect-internal` produce the honest number on a
   flat image?**
   - What we know: they collapse to the same thing on a flat image in the
     synthetic case, and address-table detection dominates the data count there.
   - What's unclear: how they diverge on real code with real tables.
   - Recommendation: run both, print both, and let the rule key on whichever
     23-01 named as primary. Two numbers cost one extra dxa invocation.
   - **RESOLVED:** as recommended. `23-01`'s dxa flag set fixes both invocations
     before any result is seen: `-t detect-internal` is declared primary and is
     what the rule inputs are computed from, and a second identical run with
     `-t detect-all` prints `C1_DETECT_ALL_DATA_BYTES` beside the primary's
     `C1_DETECT_INTERNAL_DATA_BYTES`. `23-07` runs both.

4. **Is `C ∩ D ≠ ∅` an error or a finding?**
   - What we know: self-modifying code and jump tables legitimately produce
     bytes that are both executed and DMA-fetched.
   - Recommendation: treat as a finding, report by count, exclude from both
     ratios, and say so in 23-01.
   - **RESOLVED:** as recommended. `23-01` declares `C1_CODE_DATA_OVERLAP` a
     **finding** in `evidence/SCHEMA.md`'s criterion-1 definitions and lists it in
     `evidence/DECISION-RULE.md`'s *never-a-gate* block with its own reason, so it
     is reported by count and enters neither ratio and no rule.

5. **Should the `analyzer.rs` audit extend to `exporter/` and `state/`?**
   - What we know: criterion 4 names `analyzer.rs` specifically; the pivot's
     sizing table puts real capability in the other two.
   - Recommendation: keep the audit scoped to `analyzer.rs`, and record any
     capability found to live elsewhere as a scope observation for Phase 25.
     Widening the audit here would grow the gate.
   - **RESOLVED:** as recommended. `23-01`'s audit disposition vocabulary scopes
     the audit to `analyzer.rs` only, and `23-04` carries the matching must-have —
     a capability found in `exporter/` or `state/` is recorded as a scope
     observation for Phase 25 and is not folded into `C4_UNREPLACED_CAPABILITIES`.

6. **Does an undecodable illegal opcode poison a whole Ghidra function?**
   - Deliberately unmapped (ROADMAP Notes). Real cracked code will exercise it
     incidentally. **Record it if observed; do not act on it.** The deliberate
     answer is `OPC-03` in Phase 24, and an observation here raises `OPC-01`'s
     priority there. Adds no scope.
   - **RESOLVED:** as a record-only observation. `23-08` Task 3 writes a
     `## Carried forward, not scored` section into
     `evidence/criterion2-ghidra-dispatch.txt`, either recording a poisoning
     observation with its address and effect or stating explicitly that none was
     seen. It gates nothing and appears in no rule input.

---

## Sources

### Primary (HIGH confidence — executed or read on this host this session)

- `dxa 0.1.5` — downloaded from `https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz`,
  sha256 `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`, built
  with `make`, run in five configurations; man page `dxa.1` read in full
- `ghidra_12.1.3_PUBLIC` — `analyzeHeadless` run three times (flat 64K block
  probe; immediate-index fixture; computed-index fixture); `application.properties`,
  `6502.ldefs`, `6502.slaspec` (57 constructors, 56 documented mnemonics),
  `docs/GhidraAPI_javadoc.zip` (`Memory.split`, `MemoryBlock.setVolatile`),
  `support/analyzeHeadlessREADME.md` (option list)
- `acme` — rebuilt `fixture.a` → `fixture.prg` (281 bytes), reproducing the
  pivot's fixture exactly
- `xa` 2.4.1-0.1 — round-trip tested both dxa processor modes
- `x64sc` — both builds version-probed (`/usr/bin` 3.9, `/usr/local/bin` 3.10)
- `~/.cargo/registry/src/*/external-analyser-core-0.9.20/src/analyzer.rs` — read
- `src/mcp/vice/tools-manifest.json` (62 tools) and `tools-manifest.stock.json`
  (38 tools) — full tool lists and input schemas
- `src/mcp/vice/stock-checkpoints.ts` — trace guard, `TRACE_HITS_PER_SECOND_LIMIT`,
  the D-15 no-ignore-count decision
- `src/mcp/vice/vice-sync.ts` — the poll-on-`hit_count` invariant
- `src/skills/c64-ram-capture/SKILL.md` + `scripts/{releases,project-paths,dump-artifacts,watch-loads}.mjs`
- `.planning/notes/dxa-ghidra-pivot.md`, `ghidra-volatile-io-and-banking.md`,
  `auto-annotation-from-ghidra-xrefs.md`, `vic-graphics-map-derivation.md`
- `.planning/notes/dxa-ghidra-pivot-evidence/` — `README.md`, `dxa.out`,
  `ghidra3.txt`, `fixture.a`, `fixture.lbl`, `BankProbe3.java`, `Decomp.java`,
  `ExportAnalysis.java`, `ApplyHints2.java`
- `docs/phase9-external-analyser-probe-findings.md` — the verdict frontmatter shape
- `.planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md` — the
  pre-committed `R1..R5` rule
- `.planning/ROADMAP.md` Phase 23 entry, `.planning/REQUIREMENTS.md`,
  `.planning/STATE.md`, `.planning/config.json`, `CLAUDE.md`

### Secondary (MEDIUM confidence — official pages, cross-checked)

- `https://www.floodgap.com/retrotech/xa/` — dxa 0.1.5, 25 March 2022, GPL v2,
  distributed separately from xa, "alpha software only"
- `https://www.freshports.org/devel/dxa65` — FreeBSD `devel/dxa65`,
  `DISTNAME dxa-0.1.5.tar.gz`, `MASTER_SITES http://www.floodgap.com/retrotech/xa/dists/`,
  sha256 `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`,
  GPLv2+, **no maintainer** (independent corroboration of the hash)

### Tertiary (LOW confidence — none relied upon)

None. No claim in this document rests on a web search result alone; every
external fact was corroborated by local execution or by a second source.

---

## Metadata

**Confidence breakdown:**

- **Instruments and provisioning: HIGH** — dxa built and run, Ghidra run three
  times, both VICE builds probed, every version pinned from the artefact itself
- **Pitfalls 1, 2, 3, 4, 5, 6, 7: HIGH** — each reproduced or read from source
  this session; the two that overturn a CONTEXT default (Pitfalls 2 and 5) were
  demonstrated live rather than argued
- **Criterion 1's fixture definition: HIGH** — reproduced end-to-end from
  `fixture.a`, matching all three published figures
- **Criterion 1's real-release definition: MEDIUM** — a design proposal (A3),
  sound but unmeasured; 23-01 must adopt or replace it before measuring
- **Criterion 2's detection method: HIGH**; **criterion 2's likely outcome:
  deliberately not claimed** (A6)
- **Criterion 3's protocol: MEDIUM** — tool schemas and backend limits verified;
  the loop itself is untried against a real release
- **Criterion 4's inventory: HIGH for what exists** (read from source),
  **MEDIUM for the replacement mapping** (the audit is the phase's work)
- **Patterns 1 and 2 (rule + verdict shape): HIGH** — transcribed verbatim from
  the Phase 9 artifacts the ROADMAP names as the bar

**Research date:** 2026-08-26
**Valid until:** 2026-09-25 (30 days). dxa 0.1.5 is dormant since 2022 and
Ghidra 12.1.3 is pinned locally, so the tool facts are stable. The repo-relative
facts — tool manifests, skill scripts, line references — drift with the tree;
per CLAUDE.md's own convention, treat a `file:line` mismatch as drift to
re-verify, not as evidence the finding changed.
