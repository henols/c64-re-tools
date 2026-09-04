# Phase 36: The SLEIGH Language and the Ghidra Harness — Findings

Following the structure of `docs/phase33-reproducible-run-gate-findings.md` and
`docs/phase34-host-tool-seam-decisions.md`: numbered parts, each recording what was measured,
the exact command, the output, and the disposition. Every line reference below names a file
and a symbol rather than a bare line number, since line numbers in this repository drift
between phases.

---

## Part 1 — the `sleigh` compile gate, observed red then green

**What was measured.** `sleigh-compile-gate.test.ts`'s own `COMPILE` case, against real
`support/sleigh` (Ghidra 12.1.3): the committed extension source
(`vendor/ghidra-ext/data/languages/6502_undocumented.sinc`) compiles clean — exit 0, a
produced `.sla`, mtime strictly newer than every input (`.slaspec`, every `@include`d `.sinc`,
`6502.pspec`/`6502.cspec`). A planted-violation case reverts one of the eight sized-local
fixes (the `:NOP imm16` constructor, `op=0x0c`) and observes the SAME gate go red.

**Exact command:**

```
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  node --test sleigh-compile-gate.test.ts
```

**Output.** Both the COMPILE case and the PLANTED VIOLATION case pass live; the red/green
transcript is recorded in `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-01-sleigh-gate-red.md`.

**Disposition.** `OPC-01` closed (compile gate observed both directions), citing that
evidence file. Commit `55a758c8`.

---

## Part 2 — the language-used assertion, both directions

**What was measured.** A real `analyzeHeadless` run driven through `ghidra.analyze` with the
new `6502:LE:16:nmos` language names that language, byte-exactly, in its own captured run log
(`Using Language/Compiler:` line); the SAME import under the stock `6502:LE:16:default`
language names the stock id instead.

**Output.** Recorded in `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-01-language-used.md` —
both directions, transcript quoted verbatim.

**Disposition.** `OPC-04` criterion 1's first half closed; commit `55a758c8`. Criterion 1's
second half (the 105-byte assertion observed failing under the stock language) closed in
`36-06` — see Part 5.

---

## Part 3 — the three harness gates, observed firing on a real run

**What was measured**, each against real Ghidra 12.1.3:

- **Gate 1** — a wrong `expectedClassificationLines` makes `GhidraStructExport.java` throw
  for real (the exact literal `ERROR REPORT SCRIPT ERROR`), with `analyzeHeadless`'s own exit
  status still recorded as 0; the paired negative case (override omitted) succeeds against
  the script's own computed block total.
- **Gate 2** — the classification count is the script's own computed block total, never the
  image's byte length, on BOTH import routes; the two routes' own numbers (572 on `.prg`,
  65536 on `flat64k`, over `bank.prg`) are asserted to differ.
- **Gate 3** — reproducibility (two runs under different run ids produce byte-identical
  export files) plus Ghidra's own installed version, read from
  `$GHIDRA_HOME/Ghidra/application.properties`, asserted against a named constant (`12.1.3`).

**Exact command:**

```
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  node --test ghidra-live.test.ts
```

**Output.** All gate cases pass; full transcript in
`.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-04-three-gates.md`.

**Disposition.** `GHID-01` closed. Commits `c85e096b`, `649197e4`, `e3aa896c`.

---

## Part 4 — the volatile carve's disappearance, on both import routes

**What was measured.** With the volatile flag SET (the committed `VolatileCarve.java`),
`bank.a`'s own hardware writes (four to `$0001`, two to `$d020`, one read) appear as literal
decompiled statements on both the `.prg` and `flat64k` routes. With the flag REMOVED (a
scratch-copy edit, never the committed script), three of the four `$0001` writes and one of
the two `$d020` writes VANISH from the decompiled text on BOTH routes — MEASURED, and
disclosed: `## REFERENCES` never reflects the flag at all (byte-identical with and without
it); the disappearance is visible only in `## DECOMPILED_TEXT`, a section this plan's own
predecessor (`36-05`) added additively for exactly this reason. A memory conflict, forced on
the route where a loader-owned block already covers the target range (`flat64k`), throws a
genuine `MemoryConflictException` — loud, never a silent fall-back to non-volatile.

**Exact command:**

```
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  node --test ghidra-live.test.ts --test-name-pattern=VOLATILE
```

**Output.** All VOLATILE cases pass; full transcript in
`.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-05-volatile-disappearance.md`.

**Disposition.** `GHID-02`/`GHID-03` closed on the scope `36-05-PLAN.md` itself declared (the
`.prg` route has no naturally-reachable loader-owned-block conflict for this fixture — see
that plan's own Traceability note, reproduced in Part 8 below). Commits `45d744ff`,
`9574fe35`, `ba9d873a`.

---

## Part 5 — the opcode decode results

**What was measured.** The 105-byte undocumented-opcode set, mechanically derived from the
committed `.sinc` (`op=0x[0-9a-fA-F]{2}` extraction), decodes as code under `6502:LE:16:nmos`
on a generated synthetic sweep; the IDENTICAL sweep and entry points, under
`6502:LE:16:default`, is observed FAILING the same assertion (104 of 105 undecoded; one
disclosed anomaly, `$89`, decodes under the stock language too, reproduced across two
independent runs). The six electrically-unstable/page-crossing instructions (`XAA $8b`,
immediate `LAX`/`LXA $ab`, `AHX`/`TAS`/`SHX`/`SHY`) decode to a form naming their own declared
opaque operation, with that operation's own result flowing DIRECTLY to the destination —
never plausible arithmetic. The 15 bytes both this extension and the stock 65C02 language
claim keep the 65C02's own meaning in the same installation, with none of this extension's own
pcodeop names appearing in the decompiled text; the non-collision is structural (a separate
`.ldefs` id, a separate compiled language file).

**Exact command:**

```
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  node --test ghidra-opcode-live.test.ts
```

**Output.** All eleven cases pass; full per-byte tables in
`.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-06-opcode-decode.md`.

**Disposition.** `OPC-01`, `OPC-02` and `OPC-04` (criterion 1's second half) closed. Commits
`65e7c780`, `e6a84461`, `230b91b3`.

---

## Part 6 — the corpus before/after and the acceptance run with its control

**What was measured.** Against `danish.d64`'s own first entry ("BRUCE LEE (DC)", 45074
bytes, sha256 `1a9d294e...`, the canonical Phase 33 corpus release), extracted through the
existing `anno-d64.ts` directory-and-entry route: all 105 undocumented bytes are present raw
somewhere in the extracted program's own body. Two identical `analyzeHeadless` runs (default
vs. nmos language, same five entry points, same `.prg` route) differ in classification at 103
addresses — 32 attributable to the illegal bytes' own file offsets, with a named sample of
three (`NOP $d6` at `$8ae1`, `ISC ($20,X)` at `$a660`, `ISC ($a2,X)` at `$a663`) recorded with
their decoded instructions. The acceptance run (same image, same entry points, `nmos`) carries
all five structural-fact kinds explicitly (`SPLIT_POINTER` and `SELF_MODIFYING_WRITE` found;
`ARRAY_BOUND`, `RECORD_STRIDE` and `COMPUTED_JUMP_RESOLVED` not found on this image), a
holding accounting identity (`10 = 10 + 0 + 0`, ceiling 5), typed references of the `READ`,
`WRITE` and `READ_WRITE` kinds, denominator-free unresolved-dispatch reporting (2 sites, no
ratio/percentage/total-sites figure anywhere in that section), and byte-reproducibility across
two runs. The `DataTypeManager` control, invoked directly against `analyzeHeadless` (outside
`ghidra.analyze`'s typed seam) with the identical image/route/language/script one argument
apart, returns `COMPOSITE_TYPES=0`/`DEFINED_DATA=14` — a stated near-zero threshold of 100 —
against the acceptance route's own 183 decompiled-text lines (a stated 5x multiple, observed
~13x).

**Exact commands:**

```
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-opcode-live.test.ts
GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC VICE_LIVE_GHIDRA=1 \
  VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-live.test.ts
```

**Output.** Full transcripts in
`.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-07-corpus-before-after.md`
and `.../evidence/36-07-acceptance-run.md`.

**Disposition.** `OPC-03` and `GHID-04`/`GHID-05` closed, with one MEASURED finding disclosed
rather than forced: this corpus image's own computed control transfers are all the "BRK
trick" (a `BRK` instruction whose flow is a computed jump through the unresolvable IRQ
vector), so no resolved `COMPUTED_JUMP` reference exists on it — captured instead, correctly,
in `## UNRESOLVED_DISPATCH`. Independently re-confirmed on a second, unrelated crack of the
same game (`saeger.d64`). See Part 8.

---

## Part 7 — the guards this phase touched, each with its disposition

| Guard | Disposition |
|---|---|
| `test-gate.mjs`'s `MANUAL_ONLY_TESTS` | Grown from ten to twelve entries (`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`), landed together in one commit (`36-04`, `c85e096b`) with the array edit, the dated header paragraph, and `test-gate.test.ts`'s own enumerating assertion updated in the SAME commit. Unchanged since — this plan (`36-07`) adds cases to those two already-registered files, no new file, no further edit needed. |
| `hostpath-consumers.test.ts`'s `HOST_TOOL_FAMILY_FLOOR` | Raised deliberately in `36-01` (`55a758c8`) to include `ghidra-run.ts`, with its own new term naming that plan; `SEAM-06`'s positive control extended there. No further change this plan. |
| Tracked shell-script set (`EXPECTED_TRACKED_SHELL_SCRIPTS`) | Unchanged at 5 — this phase adds no shell script anywhere (`vendor/ghidra-scripts/*.java` are Ghidra post/pre-scripts compiled at run time by Ghidra itself, not shell scripts). |
| Tracked compiled-language file count (`git ls-files -- '*.sla'`) | 0, unchanged — the `.sla` is built by `ghidra.installExtension`/`support/sleigh` and never committed (`.gitignore`), matching this phase's own "build the `.sla`, do not commit it" recommendation. |
| `ci-suite-coverage.test.ts` | Unchanged — every new test file this phase added (`sleigh-compile-gate.test.ts`, `ghidra-harness-gates.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`) sits directly under `src/mcp/vice/`, the same module directory every pre-existing test file already lives in; no new subdirectory was introduced for the registry to miss. |
| Shipped-string phase-number scan (`docs-dangling-refs.test.ts`) | Unaffected — both promoted Ghidra scripts are named for their function (`VolatileCarve.java`, `GhidraStructExport.java`, promoted from `.planning/`'s own `FlatVolatile.java`/`ExportAnalysis23.java`), never carrying a phase number in any shipped string, exactly as this phase's own `ROADMAP.md` notes required. |

---

## Part 8 — what this phase does NOT establish

- **CI has no Ghidra provisioning step.** Every live Ghidra assertion in this phase routes to
  the manual tier (`MANUAL_ONLY_TESTS`) and is never exercised by `npm run test:automated` or
  any `ci.yml` job. This is carried forward from Phase 34's own Assumption A3
  (`docs/phase34-host-tool-seam-decisions.md`) and is explicitly OUT OF SCOPE here — this
  phase's own `ROADMAP.md` notes name it as an unresolved, carried cost, not a gap this phase
  closes.
- **The corpus exercise ran on the `.prg` route** because no committed flat-64K capture of a
  corpus release exists on this tree (D-36-18) — the same route `dxa-live.test.ts`'s own prior
  corpus case established, reused rather than re-invented.
- **Unresolved dispatch is reported with no denominator, by decision** (`C2_SITES_ENUMERATED`
  stated absent, owner decision 2026-09-02, drawing on `memmapshow`) — not because this
  milestone could not have computed one, but because doing so would reproduce the exact
  unreproducible-headline mistake this project's own history warns against.
- **Each of the four `unclassified` probe rows `36-01-PLAN.md`'s own `<flagged_assumptions>`
  table named**, with what was found for each:
  - **`OPC-02`** ("declared unknown" checkable as the decoded form *naming* an opaque userop,
    not merely decoding to something) — resolved in `36-06`: all six representatives decompile
    to a bare `return uVar1;`/`... = uVar1;` naming their own pcodeop, never a computed
    expression. Confirmed true.
  - **`OPC-03`** (a before/after decompiler-output difference on the extracted corpus `.prg`
    satisfies "real code containing illegal opcodes") — resolved in `36-07` (this plan, Part
    6 above): confirmed true, with a named sample of three real instructions.
  - **`GHID-03`** (the loader-owned-block case reachable on the flat-64K route by
    construction, so the route difference IS the control) — resolved in `36-05`: confirmed
    true on `flat64k`; the `.prg` route has NO naturally-reachable loader-owned-block conflict
    for the `bank.prg` fixture (too small), recorded in `36-05-SUMMARY.md`'s own Traceability
    note as a disclosed, not silently reconciled, gap against `REQUIREMENTS.md`'s literal
    "both routes" wording.
  - **`GHID-05`** (printing `Reference.getReferenceType()` preserves the access kind end to
    end, i.e. its printed form is a stable, parseable token) — resolved in `36-07`: confirmed
    true (`READ`/`WRITE`/`READ_WRITE` all print and parse cleanly, unchanged from the
    ancestor script's own precedent). A SEPARATE, disclosed finding from the SAME task: a
    resolved `COMPUTED_JUMP` reference does not exist anywhere this plan's own entry points
    reach on this corpus image (the "BRK trick" — see Part 6), asserted as a positive fact in
    the committed test rather than silently omitted.
- **From `36-RESEARCH.md`'s own Assumptions Log:**
  - **A2** — that `-loader-baseAddr`/`-loader BinaryLoader` are the correct loader arguments
    for both routes on the NEW language id, exactly as they were on the stock id in Phase 23's
    rehearsal (not independently re-verified against `6502:LE:16:nmos` at plan-authoring time).
    This phase's own accumulated live runs (`36-01`'s seed case, `36-04`'s three gates,
    `36-05`'s volatile carve on both routes, `36-06`'s three sweeps, `36-07`'s corpus and
    acceptance runs) all used these SAME loader arguments together with `6502:LE:16:nmos` on
    both the `.prg` and `flat64k` routes, dozens of times over, with no divergence observed —
    A2 is now exercised repeatedly, though no single committed test asserts it as its own
    named claim.
  - **A3** — that the volatile pre-script's own `analyzeAll()` call, combined with
    `-noanalysis`, produces the SAME final analysis state Ghidra's own default (non-
    `-noanalysis`) automatic analysis would, on the NEW language specifically (only carried
    from Phase 23's rehearsal on the stock language, never measured on `nmos`). During this
    plan's OWN authoring-time investigation (not asserted in any committed test), the
    acceptance corpus image was run BOTH ways under `6502:LE:16:nmos` — with
    `-noanalysis`+`VolatileCarve.java`'s own `analyzeAll()`, and with Ghidra's own default
    automatic analysis and no preScript at all — and produced IDENTICAL classification and
    reference counts. This is a real data point for THIS specific image, but it is not a
    committed, re-runnable assertion; A3 stays formally unmeasured as a standing guarantee
    across other images.
