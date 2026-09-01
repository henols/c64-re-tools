---
phase: 29-the-mcp-surface
plan: 16
subsystem: testing
tags: [anno-cli, coverage-census, ci-gates, prg, information-disclosure, skills]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-14's path confinement and its T-29-14-01 sidecar redaction, whose treatment this plan mirrors onto the sibling verb"
  - phase: 29-the-mcp-surface
    provides: "29-15's corrected c64-program-recon positional, which the new invocation gate is proven against by replanting it"
provides:
  - "`anno coverage <a real .prg> --store <a real .annostore>` runs to exit 0 with a decoded payload, closing CR-05"
  - "`loadProjectImage()` — one exported image loader with two callers, replacing two independent decodes over one path"
  - "extension-first dispatch on the coverage path, so a short flat capture is refused by name rather than misread"
  - "`scripts/check-skill-cli-invocations.mjs` — an argument-checking CI gate over both skill trees, declared as the sixth CI-step gate"
  - "the T-29-14-01 content-disclosure treatment applied to the coverage verb's JSON-syntax branch"
  - "WR-14 sites 2, 4 and 5 discharged; sites 1 and 3 recorded open in 29-VERIFICATION.md's own row"
affects: [phase-30-anno-export-asm, phase-32-skill-sweep, any-future-skill-repointing]

actuals:
  tokens: 175274
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "one-definition-two-callers for the coverage image decode (`loadProjectImage`), replacing a comment-enforced invariant with a structural one"
    - "argument-checking skill gate as a sibling to the name-checking one, with predicates in scripts/lib/ so a test can call them without running the live gate"
    - "extension-before-length dispatch order copied from a named source-of-truth loader rather than re-derived"

key-files:
  created:
    - scripts/lib/anno-cli-invocations.mjs
    - scripts/lib/anno-cli-invocations.d.mts
    - scripts/check-skill-cli-invocations.mjs
    - src/mcp/vice/anno-cli-invocations.test.ts
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/prg-image.ts
    - src/mcp/vice/module-classification.ts
    - src/skills/routine-queue-walker/SKILL.md
    - .github/workflows/ci.yml
    - scripts/check-no-analyser.mjs
    - scripts/check-npm-packages.mjs
    - scripts/lib/anno-cli-verbs.mjs
    - .planning/phases/29-the-mcp-surface/29-VERIFICATION.md

key-decisions:
  - "The coverage verb's JSON-syntax failure stops interpolating V8's parse error (T-29-16-06), so both sibling verbs get one treatment for one content-disclosure class in one round"
  - "`jsonParsePosition()` is duplicated in anno-coverage.ts rather than imported from anno-memmap-render.ts — a three-line digit extractor is cheaper than coupling the census instrument to the memory-map renderer"
  - "The payload-decode interpolation is LEFT interpolated, on a measurement: every reachable zlib error is a fixed library string carrying no input bytes"
  - "The gate's per-verb positional-kind map MIRRORS the loaders rather than deriving from them, per the plan; the consequence was measured and is recorded below"
  - "WR-14 sites 1 and 3 deliberately not taken; recorded in 29-VERIFICATION.md's own WR-14 row, not only in a plan file"

patterns-established:
  - "A planted disclosure token is TEN characters, because V8 truncates its JSON parse-error snippet at ten — a longer token makes the absence assertion vacuous (inherited from 29-14 rather than rediscovered)"
  - "A line-scoped exemption pin in check-no-analyser.mjs is re-measured in the same commit as the edit that moved it, exactly like a module-classification.ts citation"

requirements-completed: [REPOINT-01, REPOINT-02]

coverage:
  - id: D1
    description: "`anno coverage game.prg --store game.annostore` runs to exit 0 against a real image and a real store, instead of printing a report of zeros and exiting 1 (CR-05)"
    requirement: "REPOINT-01"
    verification:
      - kind: e2e
        ref: "node src/mcp/vice/vice-proxy.ts anno coverage dist/cr05/game.prg --store dist/cr05/game.annostore -> exit 0, 'origin $0810, 21 byte(s), payload decoded'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#CR-05 (A): a real .prg is censused"
        status: pass
    human_judgment: false
  - id: D2
    description: "The coverage verb dispatches its positional by file EXTENSION before any length check, so a short flat capture is refused by name rather than parsed as a .prg (WR-07, T-29-16-01)"
    requirement: "REPOINT-01"
    verification:
      - kind: e2e
        ref: "anno coverage dist/cr05/short.raw -> exit 1, 'flatImageOrigin: input is 4096 byte(s) -- a flat 64K capture must be exactly 65536 bytes'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#CR-05 (C, WR-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One decode, two callers — the census's payload load and the cross-reference byte source are the same function (T-29-16-02)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#CR-05 (F, one decode two callers) and #CR-05 (F, behavioural)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#CR-05 (E, agreement) — pins the loader against anno-tools.ts's loadImage()"
        status: pass
    human_judgment: false
  - id: D4
    description: "A CI gate argument-checks every documented `anno <verb>` invocation in both skill trees, with a non-vacuity floor (REPOINT-01/REPOINT-02)"
    requirement: "REPOINT-02"
    verification:
      - kind: integration
        ref: "node scripts/check-skill-cli-invocations.mjs -> exit 0, 10 invocations across 2 trees"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts (16 cases: non-vacuity, 4 planted violations, null-vs-empty, 2 adjacency controls)"
        status: pass
      - kind: integration
        ref: "planted CR-04 positional and planted --verbose each observed RED then reverted"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gate is DECLARED in .github/workflows/ci.yml, so it runs rather than merely exists"
    requirement: "REPOINT-02"
    verification:
      - kind: other
        ref: "grep -c 'run: node scripts/check-' .github/workflows/ci.yml -> 6 (was 5); grep -c 'check-skill-cli-invocations' -> 1; python3 yaml.safe_load -> exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The coverage path's JSON-syntax failure no longer echoes the parse error's text, matching 29-14's treatment of the same shape on the sibling verb (T-29-16-06)"
    verification:
      - kind: e2e
        ref: "anno coverage <a file opening with the 10-char token QQZZORACLE> -> reason names the path and 'not valid JSON', token absent (grep -c -> 0)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#CR-05 (H, the T-29-14-01 symmetry) and #CR-05 (H, control)"
        status: pass
    human_judgment: false
  - id: D7
    description: "WR-14 sites 2, 4 and 5 discharged; sites 1 and 3 recorded open in 29-VERIFICATION.md's WR-14 row"
    verification:
      - kind: e2e
        ref: "node src/mcp/vice/vice-proxy.ts anno badverb -> 'anno: unknown verb ...' (was 'anno: unknown verb ...')"
        status: pass
      - kind: other
        ref: "git log --oneline -1 -- .planning/phases/29-the-mcp-surface/29-VERIFICATION.md -> 9f57197; diff is 1 insertion / 1 deletion, one row"
        status: pass
    human_judgment: false
  - id: D8
    description: "WR-07 — prg-image.ts's reachability rationale names an import that actually exists"
    verification:
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs -> exit 0, transitive closure from vice-proxy.ts 55 modules clean"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 16: Gap 2b, the invocation gate, and WR-14 in part — Summary

**`anno coverage game.prg --store game.annostore` now runs to exit 0 through one exported image loader with two callers, extension-dispatched before any length check, with its JSON-syntax failure no longer echoing the file's own bytes — and a new sixth CI gate argument-checks every documented `anno` invocation in both skill trees so the next dead command fails a gate rather than a review.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-30T11:47:22Z
- **Completed:** 2026-08-30T12:20:56Z
- **Tasks:** 3 (plus 2 auto-fix commits)
- **Files modified:** 15 (4 created, 11 modified)

## Accomplishments

- **CR-05 closed.** The only measurement instruction `routine-queue-walker` has runs to exit 0 with a decoded payload where it printed a report of zeros and exited 1.
- **T-29-16-02 made structural.** `projectImage()` in `anno-cli.ts` delegates to `anno-coverage.ts`'s exported `loadProjectImage()`; the two halves of one report can no longer describe different programs, because they are one call.
- **The structural blind spot closed.** `scripts/check-skill-cli-invocations.mjs` argument-checks every documented invocation in both trees, is proven by 16 committed cases plus two live planted violations, and is **declared in CI** (`run: node scripts/check-` went 5 → 6).
- **T-29-16-06 taken rather than deferred.** The coverage verb's JSON-syntax branch stops interpolating V8's parse error, so one content-disclosure class gets one treatment across both sibling verbs in one round.
- **WR-07 corrected**, WR-14 sites 2/4/5 shipped, sites 1/3 recorded open in the verification artifact itself.

## Task Commits

1. **Task 1 (tracer/tdd): one decode, two callers** — `5867c23` (feat)
2. **Task 2: the invocation gate** — `0024179` (feat)
3. *(auto-fix)* **removal-gate line-pin re-measure** — `34d0745` (fix)
4. **Task 3: WR-14 in part** — `9f57197` (docs)
5. *(auto-fix)* **FLOW-02 phase-number references** — `1409ce4` (fix)

---

# The recorded evidence

## 1. The CR-05 transcript, before and after

Fixtures built under the gitignored `dist/cr05/`: a real 23-byte `.prg` (`$0810`, `lda #$01 / sta $d020 / jsr $0819 / jmp $0810 … rts`) and a real `.annostore` carrying one typed code range, two `User` labels and one line comment.

**BEFORE** — `node src/mcp/vice/vice-proxy.ts anno coverage dist/cr05/game.prg --store dist/cr05/game.annostore`, **exit 1**:

```
coverage: .../dist/cr05/game.prg
  origin $0000, 0 byte(s), payload UNAVAILABLE -- .../game.prg is not valid JSON -- Unexpected token '', "�� � "... is not valid JSON
  ...
    reached-as-instruction : 0
    table-entry            : 0
    referenced-as-data     : 0
    unreached              : 0
    the four classes sum to 0 of 0 censused byte(s)
  ...
coverage: the project's payload was UNAVAILABLE -- .../game.prg is not valid JSON -- Unexpected token '', "�� � "... is not valid JSON
```

That one line carries **both** defects: a live image form the verb could not read (CR-05) and the file's own opening bytes echoed back out of a caller-supplied path (T-29-16-06).

**AFTER** — same command, **exit 0**:

```
coverage: .../dist/cr05/game.prg
  origin $0810, 21 byte(s), payload decoded
  schema version 2, generated 2026-08-30T11:57:20.723Z

  MEASURE 1 of 3 -- structural byte census (raw bytes plus the seed set only; the store cannot move it)
    reached-as-instruction : 21
    table-entry            : 0
    referenced-as-data     : 0
    unreached              : 0
    the four classes sum to 21 of 21 censused byte(s)
    linear-sweep decodable : 21 byte(s)
    seeds: 2 ($0810, $0819); descent steps 20; truncated: no
```

**The short flat capture** — `anno coverage dist/cr05/short.raw --store …` (4096 bytes of `$ea`), **exit 1**:

```
coverage: the project's payload was UNAVAILABLE -- .../short.raw is not an image this surface can read -- flatImageOrigin: input is 4096 byte(s) -- a flat 64K capture must be exactly 65536 bytes
```

Refused **by name**, and the reported origin is `$0000` — never `$eaea` read backwards out of its own payload. Extension dispatch runs before any length check precisely so `flatImageOrigin()`'s refusal stays reachable.

**The legacy form** — `anno coverage dist/cr05/legacy.project --store …`, **exit 0**, `origin $0810, 21 byte(s), payload decoded`. A caller with an existing project file is not broken.

## 2. The T-29-16-06 disclosure symmetry

A 10-character token planted at the head of a non-JSON file inside the workspace.

**Reason string BEFORE** (the shape 29-14 removed from the render path in this same round):

```
<path> is not valid JSON -- Unexpected token '', "<the file's own opening bytes>"... is not valid JSON
```

**Reason string AFTER:**

```
<path> is not valid JSON and is not a .prg or an exactly-65536-byte flat capture (the underlying parser message is deliberately NOT included -- it quotes the file's own bytes, CR-03)
```

`grep -c 'QQZZORACLE' <output>` → **0**, while the output still names the path and still says the file is not valid JSON. Where the runtime exposes a position (`Expected double-quoted property name in JSON at position 7`), the reason carries ` (at byte offset 7)` — a position, not content. Pinned by cases H and H-control.

**The other two interpolations in that function were inspected and LEFT, each for a stated reason:**

| Branch | Verdict | Reason |
|---|---|---|
| unreadable **PATH** throw (`AnnoCoverageInputError`) | left interpolated | Errno-class only (`ENOENT`, `EACCES`, `EISDIR`) — carries no byte of file content. 29-14 left the equivalent read-failure branch alone for exactly this reason. |
| **payload-decode** failure (`decodeRawData`) | left interpolated, **on a measurement, not an assumption** | Probed `gunzipSync(Buffer.from(x,"base64"))` across five inputs (plain ASCII, non-base64, empty, truncated gzip, corrupt body). Every reachable message is a fixed zlib string — `incorrect header check`, `unexpected end of file`, `incorrect data check` — with no fragment of the input in any of them. Library-class only. |

## 3. The invocation gate

**OK report line:**

```
check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) extracted from 20 of 60 skill file(s) across 2 trees (src/skills, installer/skills); 2 verb(s) covered (coverage, render-memmap); every flag checked against anno-cli.ts's own VERB_OPTIONS and every positional against the kinds its loader reads.
```

**Planted violation 1 — reverting 29-15's positional correction** (`sed` on `c64-program-recon/SKILL.md:255`), observed **exit 1**, then reverted:

```
check-skill-cli-invocations: FAIL
  - src/skills/c64-program-recon/SKILL.md: anno render-memmap: positional game.regen2000proj has extension .regen2000proj, which is not one this verb reads (.annostore, .store) (in: npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json)
  - installer/skills/c64-program-recon/SKILL.md: anno render-memmap: positional game.regen2000proj has extension .regen2000proj, which is not one this verb reads (.annostore, .store) (in: npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json)
```

This is the proof the gate would have caught CR-04 — and it caught it in **both** trees, which also proves the sync-first step works (the installer copy was regenerated carrying the plant).

**Planted violation 2 — an unknown flag** on the routine-queue-walker coverage line, observed **exit 1**, then reverted:

```
check-skill-cli-invocations: FAIL
  - src/skills/routine-queue-walker/SKILL.md: anno coverage: flag --verbose is not in this verb's accepted option set (--store, --out, --force, --sample) (in: node src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore --verbose)
  - installer/skills/routine-queue-walker/SKILL.md: (same)
```

The accepted set is read from `anno-cli.ts`'s own frozen `VERB_OPTIONS`, never hand-typed.

**Planted violation 3 — reverting task 1's loader change** (the `.prg` branch removed from `loadProjectImage`). **The gate stayed GREEN (exit 0), and that is the honest finding this criterion exists to surface.** The gate's `POSITIONAL_KINDS` map *mirrors* the loader (as the plan specified, with a comment naming the two functions it mirrors); it does not derive from it, so a loader that stops reading a kind the map still blesses is invisible **to this gate**. What fired instead was `anno-coverage.test.ts`:

```
not ok 117 - CR-05 (A): a real .prg is censused -- payload decoded, origin from its own load address, non-zero byte count
not ok 121 - CR-05 (E, agreement): loadProjectImage and anno-tools' loadImage answer identically for one .prg and one flat capture
```

Case E is the one that matters here: it pins the coverage loader against `anno-tools.ts`'s `loadImage()`, so a divergence between the two views of "what is an image" is caught by a test even though the gate cannot see it. **Recorded as a known limitation of the mirrored map**, with a named landing place already in the map's own comment. Deriving the map from the loader was considered and not taken: the plan specifies a mirror, and derivation would make the test's own adjacency controls tautological on that axis.

## 4. The CI wiring

```
$ grep -c 'check-skill-cli-invocations' .github/workflows/ci.yml
1
$ grep -c 'run: node scripts/check-' .github/workflows/ci.yml
6                         # was 5
$ python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"
                          # exit 0
```

Ordered gate list (`grep -n 'run: node scripts/check-\|run: bash scripts/package.sh'`):

```
170:        run: node scripts/check-npm-packages.mjs
180:        run: node scripts/check-no-analyser.mjs
187:        run: node scripts/check-skill-tool-coverage.mjs
195:        run: node scripts/check-skill-fork-honesty.mjs
205:        run: node scripts/check-skill-description-overlap.mjs
215:        run: node scripts/check-skill-cli-invocations.mjs      <-- new
218:        run: bash scripts/package.sh
```

The new step lands **after** `check-skill-description-overlap.mjs` and **before** `package.sh`, exactly as specified. No other step, trigger, matrix or permissions block changed. CI was **not** narrowed — the `*.test.*` glob `ci-guardrails` asserts is untouched.

## 5. WR-14 — the unknown-verb message, and the row

**Before:** `anno: unknown verb "badverb" -- this CLI has exactly two: render-memmap and coverage`
**After:** `anno: unknown verb "badverb" -- this CLI has exactly two: render-memmap and coverage`

Rest byte-identical; the last-resort catch's prefix moved the same way. The enclosing function keeps its name, so no consumer, test or record entry moved with it.

**29-VERIFICATION.md's WR-14 row, before:**

> `src/mcp/vice/anno-cli.ts`, `vice-proxy.ts`, … | :866/:893/:902, :300, :62, :236-239 | Mechanical rename left user-facing strings and cross-references on the retired vocabulary … | ⚠️ WARNING | WR-14.

**After** (status cell and note cell only):

> … | ⚠️ **PARTLY DISCHARGED** | WR-14. **Sites 2, 4 and 5 SHIPPED in plan 29-16** … **Sites 1 and 3 REMAIN OPEN** — the exported entry function `runAnnoCli` and the test hatch `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES`, dropped from that round on a measured decision: … a ~26-call-site rename in `anno-cli.test.ts` plus a guarded-record update in `module-classification.ts:674`/`:676` … Full reasoning: plan `29-16-PLAN.md` § `<wr14_scope_decision>`.

Carried by commit **`9f57197`**; `git diff 9f57197^..9f57197 -- 29-VERIFICATION.md` is **1 insertion, 1 deletion** — one row annotated, no row added or removed, no verdict, score or gap disposition changed.

**WR-14 disposition:** sites **2, 4, 5 shipped**; sites **1, 3 open**, for the measured reason above.

## 6. The anti-creep guard (plan-base-pinned)

```
$ PLAN_BASE=5867c23
$ git diff --stat "${PLAN_BASE}^..HEAD" -- src/mcp/vice/vice-proxy.ts src/mcp/vice/vice-proxy.test.ts
                          # (nothing)
$ git status --porcelain -- src/mcp/vice/vice-proxy.ts src/mcp/vice/vice-proxy.test.ts
                          # (nothing)
```

Both empty, measured **after** the last commit. WR-14 sites 1 and 3 did not creep back in, and T-29-16-09's line-drift exposure against `CLAUDE.md`'s MCP-02 pins is retired rather than managed.

## 7. `module-classification.ts` citations, re-measured

| Citation | Before | After | Moved? |
|---|---|---|---|
| `anno-cli.ts` `renderMemoryMap` (structured) | `:94` | `:94` | no |
| `anno-cli.ts` `buildCoverageReport` (structured) | `:99` | `:99` | no |
| `anno-cli.ts` `checkAcceptedOptions` (prose) | `:201` | **`:200`** | **yes, −1** |
| `anno-coverage.ts` `CONFIDENCE_GRADES` (structured) | `:144` | `:144` | no |
| `anno-coverage.ts` `AUTO_NAME_PREFIX_RE` (prose, cited twice) | `:1392` | **`:1393`** | **yes, +1** |

- `renderMemoryMap`/`buildCoverageReport` held because `loadProjectImage` was added to the **existing** `anno-coverage.ts` import line at `:99` and the `prg-image.ts` import removed at `:113` — both changes at or below them.
- `CONFIDENCE_GRADES` held for the reason the plan specified: **the byte-layout symbols were taken by extending the existing import line** (`:143` became `import { decodeRawData, flatImageOrigin, parsePrg } from "./prg-image.ts";`) rather than adding a line above `:144`.
- `AUTO_NAME_PREFIX_RE` moved anyway, and this is a **deviation from the plan's "prefer keeping them unmoved"**: extension dispatch needs `extname`, which `anno-coverage.ts` had no existing `node:path` import to extend, so one line was added at `:146`. Re-deriving the extension with a local regex instead was rejected — the plan says to *copy* `loadImage()`'s order, and hand-rolling its extension extractor is re-deriving it.
- **`:1392` was GREEN-WHILE-WRONG before correction.** Neither prose site names the symbol on the same line, so DIRECTION 9b degrades to existence-and-non-blank, and line 1392 became the comment's closing `*/` — non-blank, so the guard passed over a wrong citation. This is exactly the defect class 29-15 found in `c64-program-recon`. Both occurrences corrected.
- `DIRECTION 9b` was observed **RED** on the `anno-cli.ts:201` drift before correction: *"cites anno-cli.ts:201 for checkAcceptedOptions, but that line does not contain it -- drift. Line reads: `const accepted = VERB_OPTIONS[verb];`"*.
- `git diff` on the file shows **three changed line numbers and nothing else** — no verdict, rationale, fate or requirement anchor moved, and the `runAnnoCli` consumer entries at `:674`/`:676` are untouched.

## 8. `anno-cli.test.ts` assertions

**None changed, and no case deleted.** Re-run first, as instructed. The existing `coverage` cases pass `.project` / `.regen2000proj` / `.store` paths, none of which is `.prg`, `.raw`, `.bin` or exactly 65536 bytes, so all three route to the loader's trailing legacy branch and reach the same messages they did before. The absent-store case still refuses by name and still leaves no store behind; the absent-project-file case still refuses before the store is opened. `git diff` on that file across this plan is empty.

## 9. Gate counts and the tool-support table

| Gate | Result |
|---|---|
| `check-no-analyser.mjs` | exit 0 — **157** occurrences permanently exempt, **0** temporarily allow-listed across **0** entries (unchanged before and after task 3; `census-design-and-incident-records` still at 3) |
| `check-skill-tool-coverage.mjs` | exit 0 — `anno CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved` (unchanged at 2) |
| `check-skill-cli-invocations.mjs` | exit 0 — **new** |
| `check-npm-packages.mjs` | exit 0 — `@henols/vice-mcp 78 files`, `@henols/c64-re-tools 34 files, 7 skills`, transitive closure 55 modules clean (unchanged) |
| `check-skill-fork-honesty.mjs` | exit 0 |
| `check-skill-description-overlap.mjs` | exit 0 |
| `audit-gate.mjs` | exit 0 — 9 docs guards green |

`node scripts/generate-tool-support-table.mjs` then `md5sum docs/tool-support.md` → **`bb4744890855e58887142e5a97f44fc0`**, and `git status --porcelain -- docs/tool-support.md` is empty. Byte-identical, as required.

## 10. Test results

- Plan verification set (8 files): **291 tests, 291 pass, 0 fail**.
- `npm run typecheck`: clean.
- `npm run test:automated`: **2734 tests, 2727 pass, 1 fail, 1 skipped, 5 todo**.
  - The single failure is `repo-root.test.ts:178` — *"the agreed directory must not sit under `.claude` — got …/.claude/worktrees/agent-…/.vice-supervisor"*. **Purely environmental**: this executor runs in a worktree that lives at `.claude/worktrees/agent-<id>/`, which is the exact condition that assertion forbids. Not in the baseline's failing set for a main-checkout run, and not attributable to this plan.
  - Test count rose 2708 → 2734, exactly the 26 cases this plan adds (10 coverage + 16 invocation).
  - `npm test` (full glob) was deliberately **not** run — ~660 s and it blocks forever on `vice-proxy.test.ts` with no emulator. This plan does not edit that file (proven by the plan-base-pinned diff in §6).

## Decisions Made

1. **`jsonParsePosition()` is duplicated, not shared.** `anno-memmap-render.ts` owns the sibling copy, but it is the memory-map *renderer* — it pulls in the annotation store, the provenance schema and the confidence vocabulary. `anno-coverage.ts` is the census instrument and imports none of that. A three-line pure digit extractor duplicated with an explicit cross-reference in both directions is cheaper than coupling the instrument to the renderer. Both copies carry a comment saying to keep them in step and that widening either regex past `(\d+)` reopens CR-03.
2. **The payload-decode interpolation stays**, on a measurement rather than a guess — see §2's table.
3. **`prg-image.ts`'s two other stale `anno-cli.ts` attributions were corrected too**, beyond the literal WR-07 site. Both named `anno-cli.ts` as the owner of facts it no longer owns (it prefixes the refusal messages; it owns the dispatch order) — the same defect class as WR-07 itself, in the same paragraph block, and leaving them would compound a false rationale in a file this plan opens to fix exactly that. Comment prose only; no function gained a path parameter, no refusal message was reworded, no dispatch order moved in.
4. **`scripts/lib/anno-cli-invocations.d.mts` was added**, which the plan does not list. The colocated proof test cannot typecheck against a `.mjs` module under `noImplicitAny` without it; `scripts/lib/anno-cli-verbs.d.mts` is the established convention this follows. It stays out of both packages' `files[]`, as its `.mjs` sibling does.
5. **The gate's positional-kind map mirrors rather than derives** — the plan's own instruction. Its measured consequence is recorded in §3 rather than silently corrected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `check-no-analyser.mjs`'s line-scoped exemption pins drifted**

- **Found during:** Task 3 (running the pre-task gate baseline)
- **Issue:** The gate went **exit 1** with four errors. The permanent, LINE-SCOPED `census-design-and-incident-records` exemption pins *which* lines carry the two exempt mentions in `anno-coverage.ts` and the one in `anno-coverage.test.ts`; task 1's edits above them moved all three, so the gate read them as reintroductions.
- **Fix:** Re-measured with `grep -n`, not computed: `anno-coverage.ts` 1752 → 1753, `anno-coverage.test.ts` 1549 → 1557. Counts unchanged at 2 and 1, which is what makes this a re-pin rather than a reintroduction — the gate's own message states that rule. The `why` prose was updated to record the re-measure and its cause.
- **Files modified:** `scripts/check-no-analyser.mjs`
- **Verification:** gate back to exit 0, temporary allow-list still **0 entries**, permanent total unchanged at **157**.
- **Committed in:** `34d0745`

**2. [Rule 1 — Bug] Two shipped comments named a phase number (FLOW-02 / D-11.1-01)**

- **Found during:** the post-task-3 gate sweep (`audit-gate.mjs` → REFUSED, `docs-dangling-refs.test.ts` red)
- **Issue:** Comments this plan added read "deleted in phase 29 (D-14)" (`anno-coverage.ts`) and "deleted in phase 29, D-14" (`prg-image.ts`). The guard's rule is that no shipped `src/mcp/vice/` literal names a phase number — a phase is a planning artifact, not a durable remediation path.
- **Fix:** Both now name the decision and its date instead ("deleted by D-14 (2026-08-29)" / "deleted by D-14 on 2026-08-29"), which is the durable fact either way. Line-neutral, so no exemption pin or citation moved.
- **Files modified:** `src/mcp/vice/anno-coverage.ts`, `src/mcp/vice/prg-image.ts`
- **Verification:** `audit-gate.mjs` back to exit 0 with all 9 docs guards green.
- **Committed in:** `1409ce4`

### Documented departures from the plan text

**3. `anno-coverage.ts`'s `AUTO_NAME_PREFIX_RE` prose citation moved (`:1392` → `:1393`).** The plan preferred it unmoved and specified how (extend the existing `prg-image.ts` import line rather than adding one above `:144`) — **that instruction was followed and `:144` did hold**. The extra line is a separate need the plan did not anticipate: `extname` for extension dispatch, for which `anno-coverage.ts` had no existing `node:path` import to extend. Re-deriving the extension with a local regex would have been re-deriving `loadImage()`'s dispatch, which the plan forbids. Re-measured and corrected in the same task; correcting it also fixed a **green-while-wrong** citation (see §7).

**4. `prg-image.ts` — two extra prose corrections** beyond the literal WR-07 site. Rationale in *Decisions Made* item 3.

**5. `scripts/lib/anno-cli-invocations.d.mts` added.** Rationale in *Decisions Made* item 4.

---

**Total deviations:** 2 auto-fixed (both Rule 1 — a guard reddened by this plan's own edits), 3 documented departures.
**Impact on plan:** No scope creep. Both auto-fixes were regressions this plan caused in guards this plan is required to leave green; the three departures are each smaller than the alternative and each is recorded with its reason.

## Issues Encountered

- **The worktree had no `node_modules`.** `src/mcp/vice/node_modules` is gitignored and not populated in a fresh worktree, so `npm run typecheck` and every test that imports `@mastra/mcp` failed with `ERR_MODULE_NOT_FOUND`. Resolved by creating a real `node_modules/` directory in the worktree filled with symlinks to the main checkout's 213 top-level entries — a real directory rather than a symlink-to-directory, because `.gitignore`'s `node_modules/` pattern only matches directories and a bare symlink showed up as untracked. Nothing committed; `git status` stayed clean.
- **`audit-gate.mjs` reports 9 red guards on a single guard failure.** Its failure output lists every docs guard rather than the offending one, so the actual cause (`docs-dangling-refs.test.ts`) had to be found by running the nine directly. Consistent with the recorded "one guard's ENOENT reddens all six" behaviour; not a new problem and not fixed here.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Gap 2 (CR-04 + CR-05) is closed on both halves,** and the structural blind spot that let both ship green now has a gate with a non-vacuity floor, four planted-violation controls and a declared CI step.
- **Open, deliberately, and recorded in `29-VERIFICATION.md`:** WR-14 sites 1 and 3 (`runAnnoCli`, `VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES`). Their correct home is a pass that owns `anno-cli.test.ts` as its subject — the rename touches ~26 call sites there plus a guarded record in `module-classification.ts:674`/`:676`.
- **Known limitation, for whoever adds an image format next:** the invocation gate's `POSITIONAL_KINDS` map mirrors `loadProjectImage()` and `openStore()` rather than deriving from them, so a *loader* narrowing is invisible to the gate (measured — see §3). `anno-coverage.test.ts` case E is the control that catches that class. If Phase 30 adds `anno export-asm` or a new image form, add the kind in both places in the same commit; the map's own comment names them.
- **`ANNO_INVOCATION_FLOOR` is 10** and rises with the next documented invocation, in the commit that adds it.
- Nothing here touches `.planning/REQUIREMENTS.md` (29-17 owns it) or `STATE.md` / `ROADMAP.md` (the orchestrator owns those).

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*

## Self-Check: PASSED

All four created files exist on disk and all six commit hashes resolve in `git log --oneline --all`.
