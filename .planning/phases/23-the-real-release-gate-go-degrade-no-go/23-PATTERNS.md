# Phase 23: The Real-Release Gate (Go/Degrade/No-Go) - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 9 artifact classes (zero product-code files)
**Analogs found:** 8 / 9

> **Framing.** This phase ships **no product code**. Nothing under `src/` is created or
> modified — that is a checkable property (`git diff --name-only <base>..HEAD` must touch only
> `.planning/` and `docs/`). Every "file" below is a *document* or an *evidence artifact*, so
> every analog below is a document analog. Phase 9
> (`.planning/phases/09-the-assumption-probe-go-no-go/`) is the near-exact precedent for the
> whole phase shape: 8 plans, 5 waves, zero product code, one durable findings doc with a
> machine-readable verdict, ROADMAP/STATE pointers as the gate.
>
> **D-01 exclusion:** nothing here maps to the external analyser runtime/tooling as a pattern to
> follow. The one anno-adjacent analog cited (`09-*`) is cited for its *plan/evidence shape*,
> not for its subject matter. Reading `analyzer.rs` source is permitted; running anno is not.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `23-01-PLAN.md` (the pre-committed rule + schemas) | plan / pre-commitment | document | `.planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md` `<decision_rule>` block | exact |
| `23-NN-PLAN.md` (measuring plans) | plan | document | `09-01-PLAN.md` (frontmatter + `<evidence_conventions>`) | exact |
| `docs/phase23-real-release-gate-findings.md` (THE VERDICT) | findings doc | document, machine-readable frontmatter | `docs/phase9-external-analyser-probe-findings.md` | exact |
| `evidence/criterion1-*.txt` … `criterion4-*.md` | evidence transcript | append-only file I/O | `.planning/phases/09-…/evidence/criterion3-reassembly.txt` (outcome line + `## ACCEPTED LIMIT` + `## RESEARCH CORRECTIONS`) | exact |
| `evidence/inventory/*` (D-05 pre-committed inventory) | evidence, pre-commitment | document + JSON | `09-…/evidence/criterion0-prerequisites.txt` (shape only) | role-match |
| `evidence/capture/*` (flat 64K identity + machine state) | evidence record | document | `src/skills/c64-ram-capture/templates/capture-record.template.md` | exact |
| `evidence/tools/*` (dxa tarball sha256, built binary, Ghidra version) | evidence, provenance | document | `09-…/evidence/criterion1-install-and-version.txt` (`INSTALLED_VERSION:` + provenance transcript) | exact |
| Ghidra pre/post-scripts in `evidence/` (`.java`) | throwaway probe script | file I/O | `.planning/notes/dxa-ghidra-pivot-evidence/BankProbe3.java` / `ExportAnalysis.java` | role-match (**with a correction** — see below) |
| Node listing-parser probe scripts in `evidence/` (`.mjs`) | throwaway probe script | transform | `09-…/evidence/grammar-check.mjs` | exact |
| `evidence/README.md` (optional index) | index | document | `.planning/notes/dxa-ghidra-pivot-evidence/README.md` | exact |
| `.planning/ROADMAP.md` + `.planning/STATE.md` pointer edits | tracking pointer | document | `09-08-PLAN.md` (its whole shape, incl. `worktree: false`) | exact |
| `23-VERIFICATION.md` | verification report | document | `09-VERIFICATION.md` | exact |

---

## Pattern Assignments

### `23-01-PLAN.md` — the pre-committed decision rule (D-07, PROOF-05)

**Analog:** `.planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md`, `<decision_rule>`
block (lines 88-136).

Note the analog's rule lived in the *closing* plan (09-07), because Phase 9's rule was still
pre-run. **Phase 23 moves it to 23-01** (D-07) — copy the block's *structure* verbatim, place it
first. 23-01 must additionally carry the D-05 inventory schema and the criterion-1 measurement
definitions.

**Inputs table pattern** (`09-07-PLAN.md:95-105`) — every input is a literal outcome line in a
named evidence file, never a paraphrase:

```markdown
Inputs, each read from the named outcome line:

| Input | Source line | Source file |
|---|---|---|
| `c1_build` | `INSTALLED_VERSION:` present → `pass`; recorded install failure → `could-not-run` | `evidence/criterion1-install-and-version.txt` |
| `c3_4_vsf_load` | `VSF_LOAD:` | `evidence/criterion4-vsf-load.txt` |
```

**First-match-wins rule pattern** (`09-07-PLAN.md:107-131`) — each rule states its verdict, its
condition, and *why* in the milestone's own terms:

```markdown
Rules, first match wins:

- **R1 → `reconsider`.** `c1_build` is not `pass`. D-R2 makes the external analyser a *required*
  prerequisite … and no other criterion is answerable without it.
- **R4 → `degrade`.** Any of `c3_2_reassembly`, `c3_3_export_lbl`, `c3_4_vsf_load` is not
  `pass` (including `partial` and `could-not-run`). The milestone proceeds, with named
  amendments: a non-pass on 3(2) means Phase 10 criterion 4's deletion … is **not earned** …
- **R5 → `proceed`.** Everything above passed.
```

**The "not a gate" declaration** (`09-07-PLAN.md:133-136`) — copy this device for criterion 4's
capability count if no threshold is defensible pre-audit:

```markdown
**`c1_container_cost` never changes the verdict.** It is a measurement, not a gate, and the
milestone defined no cost threshold — inventing one here would be the planner making a scope
decision it has no authority to make. … Say this explicitly in the document so a later reader
cannot mistake its absence for a failure.
```

**Header framing to copy** (`09-07-PLAN.md:89-91`): *"Binding. Stated here, before the run, so
the verdict is derived and not judged. Read the … inputs from the evidence files (never from a
summary's paraphrase), then evaluate the rules **in order** and take the first that matches.
Record which rule fired."*

**Phase 23's outcome-line names** (from RESEARCH, Pattern 1): `C1_DATA_RECOVERY_PCT:`,
`C1_FALSE_POSITIVES:`, `C1_FALSE_NEGATIVES:`, `C1_ADJUDICATED_FRACTION:`, `C1_WINDOW:`,
`C2_COMPUTED_DISPATCH:` ∈ {`resolved`,`unresolved`,`not-exercised`}, `C3_BANK_DIVERGENCE:` ∈
{`found`,`not-exercised`}, `C4_UNREPLACED_CAPABILITIES:`. **`not-exercised` must be its own
value, distinct from `pass`.**

---

### `23-NN-PLAN.md` — the measuring plans

**Analog:** `.planning/phases/09-the-assumption-probe-go-no-go/09-01-PLAN.md`

**Frontmatter pattern** (`09-01-PLAN.md:1-46`) — note `files_modified` lists *evidence paths*,
and `key_links` binds an evidence file to a downstream consumer by regex:

```yaml
---
phase: 09-the-assumption-probe-go-no-go
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/09-…/evidence/criterion1-install-and-version.txt
autonomous: false
requirements: [ANNO-16]
requirement_subparts: ["ANNO-16(5) — build present and version recorded", "prerequisite for ANNO-16(1)(2)(3)(4)"]
must_haves:
  artifacts:
    - path: ".planning/phases/09-…/evidence/criterion1-install-and-version.txt"
      provides: "crates.io provenance, install transcript, --version verbatim, full --help CLI surface"
      min_lines: 20
  key_links:
    - from: "evidence/criterion1-install-and-version.txt"
      to: "$HOME/.cargo/bin/analyser"
      via: "recorded `analyser --version` output"
      pattern: "the external analyser [0-9]+\\.[0-9]+\\.[0-9]+"
---
```

**`<evidence_conventions>` block** (`09-01-PLAN.md`, binding on every plan in the phase) — copy
this whole block into 23-01 and declare it binding phase-wide. Verbatim:

```markdown
<evidence_conventions>
Binding on every task in this plan and every other plan in phase 9.

1. **Transcript convention.** Before running a command, append a line reading
   `$ <the exact command line>` to the named evidence file; then append its real stdout
   and stderr immediately below. A summary written in place of output is not evidence
   (Evidence Integrity Rule 1). Never reconstruct a transcript afterwards from memory.
2. **Worktree-independent probe directory.** Cross-wave artifacts live at
   `PROBE_DIR=$HOME/.cache/c64-re-tools/phase9`, **never** at a path inside the checkout.
   … Record the absolute `PROBE_DIR` paths in the evidence file so later waves can find them.
3. **Argv arrays, never shell strings.** Any spawn from a script uses an argv array. Do
   not interpolate a path or a filename into a shell command string (ASVS V5 …).
4. **`--vice` is never passed to the external analyser.** Not experimentally, not "just to see".
5. **Do NOT spawn a nested `claude` / `claude -p` session** … Nested sessions stall
   indefinitely in this project and the stall reports as success.
6. **Commit early.** Bank each task before starting the next; verify with `git log`.
</evidence_conventions>
```

Phase 23 substitutions: `PROBE_DIR=$HOME/.cache/c64-re-tools/phase23` (**not** `/tmp` — tmpfs,
and the pivot already lost a dxa build to it); rule 4 becomes **"the external analyser is never
executed — not the binary, not `anno-coverage.ts`, not as an oracle or a screening tool
(D-01). Reading `analyzer.rs` source is permitted."**

Also copy 09-07's addition, which is a real collision guard:

```markdown
12. **This plan is the single owner of `09-RESEARCH.md`.** Plans 09-01 through 09-06 were
    forbidden from editing it and instead recorded `## RESEARCH CORRECTIONS` sections in their
    own evidence files, so that three parallel wave-3 plans could not collide on one file.
```

---

### `docs/phase23-real-release-gate-findings.md` — the verdict (D-10, PROOF-05)

**Analog:** `docs/phase9-external-analyser-probe-findings.md` (606 lines).

**Frontmatter** (`docs/phase9-external-analyser-probe-findings.md:1-16`), verbatim:

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

Phase 23 adds `corpus: {release, file_sha256, capture_sha256}` and `tools: {dxa, ghidra, vice}`
(RESEARCH Pattern 2), because the numbers are meaningless without them.

**The "deliberate departure" sentence** (`:18-22`) — keep this device; it is what stops the
frontmatter reading as an accident against the two frontmatter-less probe docs:

```markdown
This document carries YAML frontmatter, unlike `docs/phase1-probe-results.md` and
`docs/phase2-backend-probe-evidence.md`, both of which have none — the departure is
deliberate: criterion 5 requires a machine-readable go/no-go verdict Phase 10's planner
can read as a gate, and a prose sentence buried in the body is not that.
```

**`## Verdict` as the first body section** (`:23-33`) — states the fired rule, the input value
that made it fire, **and why every earlier rule did not fire**. This is the "re-derive, don't
trust" property:

```markdown
## Verdict

**`degrade` — rule `R4` fired.**

`R4` fired because `c3_4_vsf_load = partial`, which is "not `pass` (including `partial`
and `could-not-run`)" on one of the three sub-parts `R4` names … No earlier rule
fired: `c1_build = pass` (R1 does not fire), `c2a_pty_tolerance = pass` (R2 does not
fire), `c2b_bootstrap_automatable = pass` (R3 does not fire). `R4` is therefore the first
rule, in order, whose condition is true.

**The full decision rule, reproduced verbatim from `.planning/phases/09-…/09-07-PLAN.md`'s
`<decision_rule>` block**, so this document is self-contained:

> [the entire rule, blockquoted]
```

**Section skeleton to mirror** (heading line numbers in the analog):

| Section | Line | Phase 23 equivalent |
|---|---|---|
| `## Verdict` (+ `### Scope amendments`) | 23, 97 | same; `### Scope amendments` on `degrade`, one amendment per accepted limit, **do not merge them** |
| `## Run date, host, and build tested` | 128 | corpus identity + tool pins (dxa sha256, Ghidra build, VICE backend) |
| `## Summary table` | 165 | one row per criterion: criterion, `PROOF-NN`, outcome, evidence file — every cell transcribed from an outcome line |
| one `## Criterion N` section each | 180-435 | criterion 1 must print the **fixture's reproduced** 72.46%/0-FP/27.5%-FN beside the new numbers (D-11) |
| `## Accepted limits` | 436 | one entry per failure/`could-not-run`, each naming **what it breaks** |
| `## Other findings (carried forward, not scored)` | 480 | research question 2 (illegal-opcode poisoning) lands here — record, do not act (`OPC-03`, Phase 24) |
| `## Corrections to prior documents` | 513 | two entries already waiting: `research/questions.md`'s false "real releases, already committed"; the `BankProbe3.java` verbatim-reuse correction |
| `## Reproducing this` | 574 | evidence files by relative path + the commands to re-run |

**Anti-pattern the analog names explicitly:** *"Do not summarise away a negative.
`docs/phase2-backend-probe-evidence.md` is the precedent: a check that could not be performed is
written up as fully as one that passed."* (`09-07-PLAN.md`, Task 1 action.)

---

### `evidence/criterionN-*.txt` — the transcripts

**Analog:** `.planning/phases/09-…/evidence/criterion3-reassembly.txt` (and siblings).

Three structural elements, all load-bearing:

1. **The outcome line** — bare `^[A-Z][A-Z0-9_]*: value` at column 0, which the decision rule
   greps. Examples in the analog: `criterion3-reassembly.txt:395` `REASSEMBLY: pass`;
   `criterion1-install-and-version.txt:186` `INSTALLED_VERSION: The external analyser 0.9.20`;
   `criterion1-container-toolchain-cost.txt:344` `SINGLE_STAGE_BYTES: 1256576420`.
2. **`## ACCEPTED LIMIT`** blocks (`criterion3-reassembly.txt:402`,
   `criterion3-export-lbl.txt:599`, `criterion4-vsf-load.txt:880`) — prose naming what the limit
   breaks and which requirement/phase-criterion/playbook consumes it. Excerpt
   (`criterion4-vsf-load.txt:880+`):

   ```
   ## ACCEPTED LIMIT

   The ROADMAP's standing "prefer `.vsf` over `.raw` …" constraint is **well-supported for
   RAM content and for the entry-point/start-address field** … It is **not well-supported
   for machine-type auto-detection** … Any Phase 10/11 pipeline that bootstraps a project
   from a stock-VICE `.vsf` … must **not** trust the external analyser's auto-detected system …
   ```
3. **`## RESEARCH CORRECTIONS`** blocks (`criterion1-container-toolchain-cost.txt:389`,
   `criterion3-reassembly.txt:421`, `criterion4-vsf-load.txt:900`) — numbered items, each
   pairing the contradicted claim with the observation. The closing plan collects these into the
   findings doc's `## Corrections to prior documents` in one pass.

Header line pattern (`criterion1-install-and-version.txt:1`):
`## Criterion 1 -- crates.io provenance check (Task 2, gathered live in-session)`, followed by
`$ <command>` then its literal stdout.

Note the analog also shows an **early, superseded outcome line** at `:80`
(`INSTALLED_VERSION: (not yet determined -- session-level tool permission blocked`) later
resolved at `:186`. If Phase 23 does the same, the rule must read the *final* occurrence — say
so in 23-01 rather than discovering it at verdict time.

---

### `evidence/capture/*` — the flat 64K capture record (D-03)

**Analog:** `src/skills/c64-ram-capture/templates/capture-record.template.md` — use it as-is;
it is already a template. Its load-bearing parts:

```markdown
## Identity
| Field | Value | How obtained |
| size | `65536` bytes | must be exact; anything else is not a full image |
| sha256 | `<64 hex chars>` | `node scripts/compare.mjs digest <name>.bin` |
| checkpoint / trigger address | `$____` | the address armed for this capture |

## Machine state at the capture instant
Read these *before* resuming, in the same paused window as the memory reads.
| `$01` (processor port) | `$__` `%________` | `vice_memory_read` — decides which vectors are live |
| checkpoints armed at exit | `0` | `vice_checkpoint_list` — accept only this enumeration as proof |

## Verdict
- [ ] Size is exactly 65536 bytes.
- [ ] No epoch-drift error appeared at any point during the capture.
- [ ] `vice_checkpoint_list` reported zero checkpoints before resuming.
- [ ] Machine resumed exactly once, at the end.

If any box is unchecked, void the run: rename each artifact to `<name>.VOID-<UTC timestamp>` …
```

The `$01` row is *already* the field criterion 3 needs, and the "void the run" rule is what
keeps a bad capture from silently becoming the substrate. `## Comparison against sibling runs`
(three runs, `compare.mjs compare` / `floor`) is the capture-equivalence proof.

---

### `evidence/tools/*` — provisioning provenance

**Analog:** `.planning/phases/09-…/evidence/criterion1-install-and-version.txt:1-80` — a live
provenance transcript (raw `curl` output from the registry, quoted whole) followed by the
install transcript and the `INSTALLED_VERSION:` outcome line.

Phase 23 substitutes registry provenance with: the `curl -fsSLO` line, the
`sha256sum -c -` verification line **and its output**, the `make` transcript, and outcome lines
for the built binary's size/hash plus the Ghidra `application.properties` version. RESEARCH is
explicit: **copy the tarball, its sha256 line and the built `dxa` binary into
`evidence/tools/` before the session ends** — `/tmp` is tmpfs.

---

### Ghidra pre/post-scripts under `evidence/` (`.java`)

**Analog (structure):** `.planning/notes/dxa-ghidra-pivot-evidence/BankProbe3.java` (40 lines) —
the whole file is the shape: `extends GhidraScript`, a private helper, `run()` that dumps
existing blocks first, marks volatile, seeds an entry point, `analyzeAll()`, then writes to
`getScriptArgs()[0]`.

```java
public class BankProbe3 extends GhidraScript {
    private void makeVolatile(Address start, int len) throws Exception {
        var mem = currentProgram.getMemory();
        MemoryBlock existing = mem.getBlock(start);
        if (existing != null) { existing.setVolatile(true); println("volatile(existing): " + existing.getName()); return; }
        MemoryBlock b = mem.createUninitializedBlock("VOL_" + start, start, len, false);
        b.setVolatile(true); b.setRead(true); b.setWrite(true);
    }
    @Override
    public void run() throws Exception {
        var sp = currentProgram.getAddressFactory().getDefaultAddressSpace();
        println("existing blocks:");
        for (MemoryBlock b : currentProgram.getMemory().getBlocks())
            println("  " + b.getName() + " " + b.getStart() + "-" + b.getEnd() + " vol=" + b.isVolatile());
        makeVolatile(sp.getAddress(0x0000), 2);
        makeVolatile(sp.getAddress(0xd000), 0x1000);
        Address entry = sp.getAddress(0x0810);
        disassemble(entry); createFunction(entry, "start");
        currentProgram.getSymbolTable().addExternalEntryPoint(entry);
        analyzeAll(currentProgram);
        PrintWriter out = new PrintWriter(new FileWriter(getScriptArgs()[0]));
        …
    }
}
```

> ⚠️ **DO NOT COPY `makeVolatile()`'s body verbatim.** CONTEXT's discretion note recommends the
> `getBlock()`-first guard verbatim; **RESEARCH Pitfall 2 overturns it**, verified live. On a
> flat 64K raw import there is exactly one block `RAM 0000-ffff`, so `getBlock(0x0000)` returns
> it and `setVolatile(true)` marks **the entire address space** volatile — silently. Use
> `Memory.split()` to carve `$0000-$0001` and `$D000-$DFFF` out first, then `setVolatile()` on
> the carved blocks. The RESEARCH § *Code Examples* → "Ghidra pre-script: volatile I/O on a flat
> 64K image (the corrected pattern)" carries the corrected code; use that, and keep the
> surrounding structure (block dump before and after, `println` of every mutation) from
> `BankProbe3.java`.

**Analog (export format):** `.planning/notes/dxa-ghidra-pivot-evidence/ExportAnalysis.java:14-30`
— `## SECTION`-delimited plain text, one fact per line, written to `getScriptArgs()[0]`:

```java
out.println("## CLASSIFICATION");
for (AddressRange r : currentProgram.getMemory().getAddressRanges()) {
    for (Address a = r.getMinAddress(); a.compareTo(r.getMaxAddress()) <= 0; a = a.next()) {
        CodeUnit cu = lst.getCodeUnitContaining(a);
        String kind = "undef";
        if (cu instanceof Instruction) kind = "code";
        else if (cu instanceof Data) kind = ((Data) cu).isDefined() ? "data" : "undef";
        out.println(String.format("%s %s", a, kind));
        if (a.equals(r.getMaxAddress())) break;
    }
}
out.println("## FUNCTIONS");
```

Its `## CLASSIFICATION` and `## REFERENCES` sections are exactly what criteria 1 and 2 read
(RESEARCH Pitfall 5 corrects the pivot README's blanket "this is the trap" label — only
`## STRUCTS` is the trap). Remove the 400-reference cap.

---

### Node probe scripts under `evidence/` (`.mjs`)

**Analog:** `.planning/phases/09-…/evidence/grammar-check.mjs:1-19` — the header comment is the
pattern, and it does three things worth copying exactly: declares itself throwaway evidence,
cites the real consumer it mirrors by `file:line`, and states why it does **not** import from it:

```javascript
#!/usr/bin/env node
// Throwaway line-by-line matcher for phase 9 criterion 3(3) -- evidence, not a
// deliverable. Tests every line of a VICE label file against the EXACT regex this
// repo's real consumer uses, copied verbatim (not paraphrased, not re-derived):
//
//   .claude/mcp/vice/stock-symbols.ts:75
//   const VICE_LABEL_LINE_RE = /^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/;
//
// This script deliberately does NOT import from stock-symbols.ts (it is a .ts module
// with a non-exported const, and this plan must not add an export to it just for a
// throwaway probe script). …
// This is the ONLY regex in this script -- no second label-file parser is written here.
//
// Run with: node grammar-check.mjs <path-to-.lbl-file>
```

Phase 23's dxa `-a dump` column parser is the direct analogue. Carry the "only one parser in
this file" discipline, and add RESEARCH's byte-total assertion (`code + data == |W|`) so an
unseen line shape becomes a refusal rather than a silent undercount (Assumption A2).

These scripts **must not** land outside `evidence/`, must not be added to `resources/` or any
manifest, and must not re-implement anything in RESEARCH § *Don't Hand-Roll*
(`dump-artifacts.mjs assemble`, `compare.mjs digest`, `d64-parse.mjs directory`).

---

### `evidence/README.md` (optional index)

**Analog:** `.planning/notes/dxa-ghidra-pivot-evidence/README.md` (27 lines) — a title line
naming the activity and date, a two-sentence "why this exists" (in the analog: *"Preserved here
because the working copy lived in `/tmp`, which is tmpfs on this host."*), then a
`| File | What it is |` table where each row states both what the artifact is **and what it
proves**, e.g.:

```markdown
| `bank.txt` | Ghidra output **without** volatile I/O — shows the silent dead-store deletion of hardware writes |
| `bank3.txt` | Ghidra output **with** volatile I/O — every `$01` literal preserved in program order |
| `BankProbe3.java` | The pre-script that sets the volatile blocks (note the `getBlock()`-first guard …) |
```

It also closes with the external-input note Phase 23 needs for Ghidra: *"Ghidra was installed to
`~/dev/_ghidra-probe` (1.4 GB) purely for this probe and is safe to delete; nothing in the repo
depends on that path."* — record the **version** in evidence, never the path.

---

### `.planning/ROADMAP.md` + `.planning/STATE.md` — the gate pointers (D-08)

**Analog:** `.planning/phases/09-…/09-08-PLAN.md` — copy this plan almost wholesale.

**Frontmatter, including the worktree opt-out** (`09-08-PLAN.md:1-16`):

```yaml
files_modified:
  - .planning/STATE.md
  - .planning/ROADMAP.md
autonomous: true
worktree: false
worktree_reason: "This plan's deliverable IS .planning/STATE.md and .planning/ROADMAP.md content. Worktree isolation forbids executors from touching those two files and execute-plan strips them from the commit automatically, so under worktree isolation this plan cannot deliver at all — silently. Run it sequentially on the main tree with USE_WORKTREES_FOR_PLAN=false and let it own its own tracking writes."
```

**The single-source-of-truth rule** (`09-08-PLAN.md`, Task 1 action) — the pointer must not copy
the outcomes:

```markdown
Add one entry to `### Decisions`, in the existing `- [Phase 09]: …` shape. It must contain:
the verdict value verbatim, the rule that fired (`R1`-`R5`) and the input value that made it
fire, the installed … version the finding is qualified by, and the literal
path `docs/phase9-external-analyser-probe-findings.md`. … **Do not restate the
per-criterion outcomes here**; a second copy of the seven values is a second thing that can
drift out of agreement with the first.
```

Plus the STATE.md counter warning, which this repo has been bitten by repeatedly:

```markdown
Do **not** hand-edit STATE.md's frontmatter progress counters. If they need advancing, use
the GSD SDK's own state/progress handlers … If a tool call writes a stale `Current Position`
over your edit, repair the body afterwards and do not pin any magic number in an assertion.
```

Its verify step also shows the guard that the findings doc is not touched by the pointer plan:

```bash
grep -q 'phase9-external-analyser-probe-findings.md' .planning/STATE.md && \
grep -qE '\[Phase 09\]' .planning/STATE.md && \
grep -qE 'proceed|degrade|reconsider' .planning/STATE.md && \
test -z "$(git diff --name-only -- docs/phase9-external-analyser-probe-findings.md)"
```

Phase 23's ROADMAP edit targets Phase 24's `**Depends on**` line and Notes. The analog's own
anti-scope-drift instruction applies: amendments are written **beside** the downstream phase's
success criteria, never over them (confirmed in `09-VERIFICATION.md`: *"Phase 10/11
success-criteria text itself is left unmodified per the plan's explicit anti-scope-drift
instruction"*).

---

### `23-VERIFICATION.md`

**Analog:** `.planning/phases/09-…/09-VERIFICATION.md:1-60`. Frontmatter
(`phase`/`verified`/`status`/`score`/`overrides_applied`), then a **`## What This Phase Is`**
section that pre-empts the "no code, no tests" false gap:

```markdown
## What This Phase Is

A probe/gate phase. It deliberately produces no product code — evidence transcripts under
`evidence/`, one durable findings document (`docs/phase9-external-analyser-probe-findings.md`),
and a machine-readable verdict. Absence of source changes and new tests is by design and is not
treated as a gap.
```

Then `## Goal Achievement` → Observable Truths / Required Artifacts / Key Link Verification
tables, where **every Evidence cell cites `file:line` and quotes the outcome line** —
e.g. ``` `evidence/criterion3-reassembly.txt:395` `REASSEMBLY: pass` ```. Copy that citation
density; it is what made criterion 5's adjudication checkable.

---

## Shared Patterns

### Ordering-as-proof (D-07 / PROOF-05)
**Source:** `09-07-PLAN.md` `<decision_rule>` header + `09-01-PLAN.md` evidence convention 6
(*"Commit early. Bank each task before starting the next; verify with `git log`."*)
**Apply to:** every plan.
The gate's entire integrity is `git log` ordering: 23-01's commit precedes the first measurement
commit, and the D-05 inventory commit precedes the first `criterion[123]` evidence commit. Both
are checkable with:

```bash
git log --oneline --reverse -- .planning/phases/23-the-real-release-gate-go-degrade-no-go | head -1
```

RESEARCH Pitfall 8: this is **one-way**. Record `git log --oneline -1` of 23-01 into evidence
before the first measurement.

### Outcome lines are the only rule inputs
**Source:** `09-07-PLAN.md:89-105`
**Apply to:** every evidence file and the findings doc.
`^NAME: value` at column 0, read from the file, never from a summary's paraphrase. A rule input
that requires judgement is not a rule input.

### No-product-code invariant
**Source:** `09-VERIFICATION.md` § *What This Phase Is*
**Apply to:** every plan's verify step.
```bash
git diff --name-only <base>..HEAD    # must touch only .planning/ and docs/, nothing under src/
```

### Throwaway artifacts survive tmpfs
**Source:** `.planning/notes/dxa-ghidra-pivot-evidence/README.md` (its stated reason for
existing) + `09-01-PLAN.md` evidence convention 2.
**Apply to:** dxa tarball/binary, Ghidra transcripts, the capture, every probe script.
Cross-wave artifacts go to `$HOME/.cache/c64-re-tools/phase23`, never a path inside the checkout
(worktrees are force-removed at wave close) and never `/tmp` (tmpfs, 16 GB, cleared on reboot).
Anything that matters is copied into `evidence/` before the session ends.

### Corpus is untrusted input; identity by hash, image not committed
**Source:** capture-record template (`sha256` row) + RESEARCH § Security V5/V6/V12.
**Apply to:** every plan touching the corpus.
`compare.mjs digest` is the only hashing seam; `d64-parse.mjs directory --json` runs before
anything boots; the image itself is **never committed** (D-04 — identity is name + sha256), so
check whether `.gitignore` needs a line for `evidence/corpus/`.

### Single-owner file rule for parallel waves
**Source:** `09-07-PLAN.md` `<evidence_conventions>` item 12.
**Apply to:** `23-RESEARCH.md` and the findings doc.
Measuring plans record `## RESEARCH CORRECTIONS` in their **own** evidence files; exactly one
closing plan collects and applies them. Two parallel plans must never edit one document.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `evidence/inventory/*` (D-05 pre-committed corpus inventory: `$01` write timeline, dispatch sites, certain-code / certain-data sets) | evidence, pre-commitment | event-driven capture → structured record | **No analog exists.** Nothing in this repo records a runtime-observed inventory as a pre-commitment ahead of a measurement. `09-…/evidence/criterion0-prerequisites.txt` is the closest for *tone* (a facts-first file gathered before the substantive work) but has no schema, no timeline shape, and no pre-commitment semantics. The `watch-loads.mjs` hit-log shape in `src/skills/c64-ram-capture/scripts/` is the nearest **data** shape for a `(PC, value)` hit log and is worth reading, but it is not a pre-commitment artifact. **23-01 must invent this schema outright** — RESEARCH Pattern 4 and Pattern 5 supply the field content (`(cycle, PC, value)` triples, hit ceiling declared before the run, saturation-vs-ceiling termination flag), and the planner should follow the outcome-line convention above so the inventory's facts are greppable rule inputs. |

---

## Metadata

**Analog search scope:** `.planning/phases/09-the-assumption-probe-go-no-go/` (all 8 plans +
evidence + VERIFICATION), `.planning/notes/dxa-ghidra-pivot-evidence/`, `docs/`,
`src/skills/c64-ram-capture/templates/`
**Files scanned:** ~30; 12 read in depth
**Pattern extraction date:** 2026-08-26
