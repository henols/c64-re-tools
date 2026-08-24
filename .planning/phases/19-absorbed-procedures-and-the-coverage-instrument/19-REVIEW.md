---
phase: 19-absorbed-procedures-and-the-coverage-instrument
reviewed: 2026-08-24T18:33:32Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - CLAUDE.md
  - .github/workflows/ci.yml
  - installer/package.json
  - installer/THIRD-PARTY-NOTICES.md
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/lib/r2000-cli-verbs.mjs
  - scripts/lib/skill-corpus.d.mts
  - scripts/lib/skill-descriptions.d.mts
  - scripts/lib/skill-descriptions.mjs
  - src/mcp/vice/ci-guardrails.test.mjs
  - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
  - src/mcp/vice/fixtures/coverage/README.md
  - src/mcp/vice/fixtures/coverage/nc1-all-auto/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc1-all-auto/store.json
  - src/mcp/vice/fixtures/coverage/nc1b-auto-renamed-in-place/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc1b-auto-renamed-in-place/store.json
  - src/mcp/vice/fixtures/coverage/nc2-generic-comments/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc2-generic-comments/store.json
  - src/mcp/vice/fixtures/coverage/nc3-all-data-blocks/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc3-all-data-blocks/store.json
  - src/mcp/vice/fixtures/coverage/nc4-multi-caller-unnamed/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc4-multi-caller-unnamed/store.json
  - src/mcp/vice/fixtures/coverage/nc5-well-documented/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc5-well-documented/store.json
  - src/mcp/vice/package.json
  - src/mcp/vice/r2000-cli.test.ts
  - src/mcp/vice/r2000-cli.ts
  - src/mcp/vice/r2000-coverage.test.ts
  - src/mcp/vice/r2000-coverage.ts
  - src/mcp/vice/r2000-tools.ts
  - src/mcp/vice/r2000-upstream-audit.test.ts
  - src/mcp/vice/r2000-verb-coverage.test.ts
  - src/mcp/vice/skill-attribution.test.ts
  - src/mcp/vice/skill-description-overlap.test.ts
  - src/mcp/vice/THIRD-PARTY-NOTICES.md
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-program-recon/scripts/packer-finding.mjs
  - src/skills/c64-program-recon/scripts/packer-finding.test.mjs
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/routine-queue-walker/SKILL.md
  - THIRD-PARTY-NOTICES.md
findings:
  critical: 3
  warning: 12
  info: 4
  total: 19
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-24T18:33:32Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Two deliverables were reviewed: the absorption of five upstream `regenerator2000`
analysis procedures into `src/skills/` with per-file attribution, and a new
coverage-census instrument (`r2000-coverage.ts`, ~1450 lines) plus its CLI verb,
fixtures, guards and a packer-identity recon finding.

The guard scaffolding is genuinely strong. `scripts/lib/skill-descriptions.mjs`
and its colocated test are non-vacuous (planted duplicates, planted stale
allowlist entries, an inclusive-threshold boundary test, a false-positive control
against the real corpus). `r2000-verb-coverage.test.ts` parses the real dispatch
switch and proves the parser bites on a planted case. `skill-attribution.test.ts`
proves both its presence and absence predicates against planted strings. The
`check-npm-packages.mjs` change correctly converts a pinned skill count into a
relation-plus-floor. Typecheck is clean and every guard script and new suite
passes locally (93/93, one visible skip).

The defects are concentrated in the measurement code itself, and they are the
exact defect class the module's own header names: **the instrument can be made to
report coverage it never proved, and can be talked out of a real finding.** Both
were reproduced against the shipped code, not inferred:

- an ordinary two-table indexed read loop (a screen+colour copy — ubiquitous in
  C64 code) moves a census from **7 reached / 55 unreached to 63 reached / 1
  unreached**, because the split lo/hi table heuristic reconstructs targets from
  ordinary data and feeds them back as descent seeds;
- a comment mentioning **any** longer hex address whose leading digits happen to
  match a caller address satisfies the multi-caller rule, so a
  documented-without-naming-a-caller label passes.

Separately, the phase's own ABS-02 obligation is not discharged: the elected MIT
licence's permission notice is reproduced nowhere in either published tarball,
and `src/mcp/vice/THIRD-PARTY-NOTICES.md` states — incorrectly — that it is.

## Critical Issues

### CR-01: `namesACaller()` matches caller addresses as unanchored substrings, defeating the multi-caller rule

**File:** `src/mcp/vice/r2000-coverage.ts:992-1006`

**Issue:** The COV-02 multi-caller rule ("a label with strictly more than one
caller must name a caller") is satisfied by a plain `String.includes` of
`` `$${hex}` `` with no boundary check. Any longer hexadecimal address in the
comment whose leading digits coincide with a caller's short-form hex rescues the
label. Reproduced against the shipped code:

```
callers: [0x0012, 0x0034]
comment: "[confirmed-code] reads the table at $1234 and returns"
=> multiCallerUndocumented = { count: 0, addresses: [] }
```

The comment names neither caller. The label is silently counted as documented,
stays in `labels.kindRatio.user`, stays in the reproducibility sample population,
and produces no finding. This is a **falsely-clean verdict** — the failure mode
`r2000-coverage.test.ts`'s own header calls out as T-19-14, and the one the NC4
control fixture exists to catch. NC4 only passes because its comment happens not
to contain a colliding hex string.

The label-name branch has the same shape: `rawComment.includes(name)` matches a
caller's label name anywhere in the text, including as a substring of a longer
identifier.

**Fix:** Match on a delimited token, and compare against a canonical width.

```ts
function namesACaller(
  rawComment: string,
  callers: readonly number[],
  nameByAddress: ReadonlyMap<number, string>,
): boolean {
  const lower = rawComment.toLowerCase();
  for (const caller of callers) {
    const hex = caller.toString(16).toLowerCase();
    // Anchor on a non-hex-digit (or end of string) after the token, so
    // "$12" never matches inside "$1234".
    for (const token of new Set([hex, hex.padStart(4, "0")])) {
      const re = new RegExp(`\\$${token}(?![0-9a-f])`, "i");
      if (re.test(lower)) return true;
    }
    const name = nameByAddress.get(caller);
    // Word-boundary the label name too: "loop" must not match "main_loop".
    if (name && new RegExp(`(?<![A-Za-z0-9_])${escapeRe(name)}(?![A-Za-z0-9_])`).test(rawComment)) {
      return true;
    }
  }
  return false;
}
```

Add a negative control to `r2000-coverage.test.ts` asserting that
`callers: [0x12]` plus a comment containing only `$1234` is reported as
undocumented.

### CR-02: the split lo/hi table scan manufactures census coverage from ordinary data

**File:** `src/mcp/vice/r2000-coverage.ts:580-621` (feeding `buildCoverageReport` at `:1308-1312`)

**Issue:** The class-3 scan pairs **any** two indexed `ld*` instructions occurring
within `SPLIT_TABLE_WINDOW` (8) decoded instructions, assumes their operands are
the bases of an adjacent lo/hi pointer table, assumes the table length is
`hiBase - loBase`, reconstructs that many 16-bit "targets" out of whatever bytes
are there, and returns them in `discoveredTargets`. `buildCoverageReport()` then
passes `discoveredTargets` straight in as `extraSeeds` to the descent walk, and
`tableEntryAddresses` as table entries.

There is no test that the two loads are related, no test that either base holds
pointer data, and no test that the reconstructed values are plausible entry
points. A two-table indexed read loop — `lda screen,x` / `lda colour,x`, one of
the most common shapes in C64 code — matches. Reproduced against the shipped
code with a 64-byte program whose only real code is 7 bytes:

```
plain census    reached=7   tableEntry=0  referencedAsData=2  unreached=55
with the scan   reached=63  tableEntry=0  referencedAsData=0  unreached=1
```

56 bytes of ordinary data were promoted to `reached-as-instruction`, the headline
measure. This directly contradicts the module's own trap 2 ("`reachedAsInstruction`
means REACHED BY RECURSIVE DESCENT FROM A SEED") and its own stated rule at
`DATA_REF_MNEMONICS` ("guessing a length here would manufacture coverage that was
never proven"). The `linearSweepDecodable` / `reachedAsInstruction` separation the
module is built around is worthless if arbitrary data can be injected into the
seed set.

**Fix:** Split-table targets must not be treated as proven. Minimum change:

```ts
// buildCoverageReport(): seed the descent ONLY from evidence-backed targets.
const provenTargets = [
  ...dispatch.indirectJumps.flatMap((j) => (j.target !== null ? [j.target] : [])),
  ...dispatch.multiEntryTables.flatMap((t) => t.targets),
];
const structural = computeStructuralCensus(loaded.bytes, loaded.origin, seeds, {
  tableEntryAddresses: dispatch.tableEntryAddresses,
  extraSeeds: provenTargets,   // NOT dispatch.discoveredTargets
});
```

and tighten the pairing itself: require the two loads to share the same index
register, require every reconstructed target to land inside the image *and* on a
byte the census already reached or that decodes as a legal opcode, and report the
split-table findings as *candidates* in the dispatch sub-report rather than as
census input. `classFromBytes()` (`:972-978`) must stop returning `"code"` for a
bare `discoveredTargets.includes(address)` for the same reason.

### CR-03: the elected MIT licence's permission notice ships nowhere, and the notices file states that it does

**File:** `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117`, `installer/THIRD-PARTY-NOTICES.md`, every `ATTRIBUTION (ABS-02)` block (e.g. `src/skills/routine-queue-walker/SKILL.md:6-40`)

**Issue:** The project elects **MIT** for the incorporated `regenerator2000`
prose. The MIT licence requires that *"The above copyright notice and this
permission notice shall be included in all copies or substantial portions of the
Software."* A repo-wide search finds the string `Permission is hereby granted`
in exactly one place — a 2018-vintage planning document — and **nowhere** in
`src/skills/`, `installer/THIRD-PARTY-NOTICES.md`,
`src/mcp/vice/THIRD-PARTY-NOTICES.md`, or either published tarball. Only the
copyright line (`Copyright (c) 2026 Ricardo Quesada`) travels.

Compounding it, `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117` asserts:

> "The MIT permission notice and copyright above travel inside every absorbed
> file's header, which is what ships in both published tarballs."

That statement is false as written — verified against every attribution block.
Electing Apache-2.0 instead would not help: §4(a) requires shipping a copy of the
Apache licence. So neither dual option is currently discharged, and both npm
packages publish adapted third-party text without its permission notice.

**Fix:** Add the verbatim upstream MIT permission notice to both notices
documents, and correct the false claim.

```markdown
## Upstream MIT permission notice (regenerator2000)

Copyright (c) 2026 Ricardo Quesada

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, ... [full verbatim LICENSE-MIT text from
the pinned commit] ...
```

Then extend `skill-attribution.test.ts` with a seventh assertion: the packed
notices document of each tarball contains the permission notice text, so this
cannot silently regress. Consider adding the notice (or an explicit pointer to
the shipped notices file) to the per-file `ATTRIBUTION` blocks, since a consumer
copying one playbook out of the package is the case the header exists to cover.

## Warnings

### WR-01: split-table lo/hi roles are assigned by address order, producing byte-swapped targets, and the same idiom is reported twice

**File:** `src/mcp/vice/r2000-coverage.ts:591-592`, `:605-618`, `:626-664`

**Issue:** `loBase = Math.min(a, b); hiBase = Math.max(a, b)` assumes the low-byte
table always sits at the lower address. Nothing justifies that. The file's own
class-4 fixture demonstrates the counter-case: in the stack-return idiom the HI
table is at the lower address, and the class-3 scan matches the *same two
instructions*, producing a second finding with the two tables swapped:

```
splitTables: [{ at: $c000, loBase: $c010, hiBase: $c013, targets: [$05c0, $05c0, $05c0] }]
stackReturn: [{ at: $c000, loBase: $c013, hiBase: $c010, targets: [$c006, $c006, $c006] }]
```

`$05c0` is `$c005` byte-swapped — pure garbage. On a real 64K image such values
land in range and become `discoveredTargets`. The class-3 and class-4 scans also
double-count the idiom in every printed count and in `tableEntryAddresses`.

**Fix:** Skip a class-3 pairing whose instruction window already matched the
class-4 idiom (record matched `at` addresses in a set during the class-4 pass and
run it first), and either infer lo/hi from the surrounding push order or report
both orientations explicitly as unresolved rather than picking one silently.

### WR-02: `autoPrefixNamesRemaining` and `multiCallerUndocumented.count` are pre-dedup lengths reported beside deduped address lists

**File:** `src/mcp/vice/r2000-coverage.ts:746-747`, `:1061`, `:1090`

**Issue:** `autoPrefixNamesRemaining: autoPrefixNameAddresses.length` is computed
before `sortedUniqueNumbers()` is applied to the list that is reported. Two
symbols at one address produce `autoPrefixNamesRemaining: 2` with a single
address. Reproduced:

```
autoPrefixNamesRemaining = 2   autoPrefixNameAddresses = ['1000']
```

`coverageFindings()` (`:1394-1399`) and `printCoverageReport()` print both in one
sentence, so the message contradicts itself: *"2 label name(s) still carry an
auto-name prefix at $1000"*. `multiCallerUndocumented.count` has the same shape.

**Fix:** Derive the count from the deduped list.

```ts
const uniqueAutoPrefix = sortedUniqueNumbers(autoPrefixNameAddresses);
return {
  ...
  autoPrefixNamesRemaining: uniqueAutoPrefix.length,
  autoPrefixNameAddresses: uniqueAutoPrefix,
```

and likewise `count: sortedUniqueNumbers(multiCallerUndocumented).length`.

### WR-03: the descent walk counts illegal/JAM opcodes as instructions; the linear sweep does not

**File:** `src/mcp/vice/r2000-coverage.ts:381-407` versus `:414-419`

**Issue:** The linear sweep explicitly skips `insn.illegal`; the descent walk
never inspects it, marks the bytes `reached-as-instruction`, and keeps walking
through them. A run of `0x02` (JAM) reports `reached=4` against
`linearSweepDecodable=1` over the same 4 bytes. A descent that has decoded a JAM
has, by definition, left real code — continuing past it inflates the headline
measure with garbage, and does so *asymmetrically* to the figure it is meant to
be contrasted against.

**Fix:** Stop the trace at an illegal opcode, and record it, rather than walking
through it.

```ts
if (!decoded || decoded.notes.includes("truncated")) break;
if (decoded.illegal) break;  // a descent that decoded an illegal opcode has left real code
```

If illegal opcodes are wanted (some crunchers use them deliberately), gate on the
project's `use_illegal_opcodes` setting rather than ignoring the flag entirely —
but keep the descent and sweep rules identical either way.

### WR-04: the cross-reference bound is printed but never recorded in the JSON report

**File:** `src/mcp/vice/r2000-cli.ts:1276-1284`, `:1418-1427`

**Issue:** `MAX_COVERAGE_CROSS_REFERENCE_LOOKUPS` (512) caps the per-label
cross-reference lookups. When it bites, `printCoverageReport()` prints a NOTE
saying the multi-caller count is a floor — but that fact never reaches
`buildCoverageReport()` and therefore never reaches the JSON written by `--out`.
A Phase 20 consumer reading the report file sees a `multiCallerUndocumented`
count with no indication that it was measured over the lowest 512 addresses of a
larger population. That is precisely COV-02's "a measure computed over less than
the whole population must say so", violated on the machine-readable side.

**Fix:** Thread the bound into the report.

```ts
// CoverageOptions
crossReferenceBound?: { requested: number; performed: number };
// Reproducibility
crossReferencesBounded: boolean;
crossReferenceBoundReason: string | null;
```

Set them in `computeReproducibility()`, bump `COVERAGE_SCHEMA_VERSION`, update
the key-set assertion, and add a `reproducibility` finding in `coverageFindings()`
when the bound bit.

### WR-05: `--sample` silently accepts and truncates non-integer input

**File:** `src/mcp/vice/r2000-cli.ts:1112-1116`, `:1349-1352`

**Issue:** `Number.parseInt(value, 10)` accepts a trailing-garbage prefix, so
`--sample 4abc` → `4`, `--sample 3.7` → `3`, `--sample 1e9` → `1`. Each passes
`Number.isInteger(sample) && sample > 0` and silently changes the sample rule
recorded in the report. This is the same class as WR-08's documented lesson for
`--out`/`--entry`, applied inconsistently to `--sample`.

**Fix:**

```ts
} else if (a === "--sample") {
  const value = rest[i + 1];
  if (value === undefined || value.startsWith("--")) {
    sampleMissingValue = true;
  } else {
    sampleRaw = value;
    sample = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    i++;
  }
}
```

### WR-06: the entire coverage CLI surface is untested

**File:** `src/mcp/vice/r2000-cli.ts:1078-1443`

**Issue:** `parseCoverageArgs()`, `printCoverageReport()` and `cmdCoverage()` are
~250 new lines with zero direct test coverage — a repo-wide search for those
three identifiers finds only their definitions and call sites. The only test
touching `coverage` at all is the `VERB_OPTIONS`/USAGE agreement check. Notably,
`printCoverageReport()` is the **sole enforcement point** of COV-01's display-side
prohibition ("never compute a combined figure at the point of display"), and that
prohibition currently exists only as a comment. Every refusal path
(`outMissingValue`, `sampleMissingValue`, bad `--sample`, refused overwrite,
`payloadDecoded === false` → exit 1) is likewise unasserted.

**Fix:** Export `printCoverageReport` and `parseCoverageArgs` (or extract the
rendering into a pure `renderCoverageReport(report, bound): string[]`) and add
tests that (a) drive every refusal branch through `runR2000Cli(["coverage", ...])`,
and (b) assert the rendered output contains no number that is not present in the
report object — the mechanical form of "no combined figure at the point of
display".

### WR-07: `parseCoverageArgs`'s `unknownOption` branch is unreachable

**File:** `src/mcp/vice/r2000-cli.ts:1123-1124`, `:1328-1332`

**Issue:** `runR2000Cli()` calls `checkAcceptedOptions(verb, rest)` before
dispatch, and `VERB_OPTIONS.coverage` is exactly `["--out", "--force",
"--sample"]`. Any `--`-shaped token outside that set is refused there, so
`parseCoverageArgs`'s `unknownOption` field and `cmdCoverage`'s corresponding
refusal block can never execute. Dead code in a file whose whole discipline is
"one place enforces the closed option set for every verb".

**Fix:** Delete `unknownOption` from `CoverageParsedArgs`, the parser and
`cmdCoverage`, letting the token fall through to `positional` like every other
verb's parser does; or, if the local check is wanted as defence in depth, say so
in a comment and add a test that reaches it by calling `cmdCoverage` directly.

### WR-08: the oracle's raw stdout reaches a second, unsanitised report field

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:481-482` (contradicting the header at `:78-80`)

**Issue:** The module header states: *"The oracle's standard output reaches
exactly one field, through one bounded parser that evaluates nothing (T-19-19)."*
It reaches two. `packer` goes through `parseUnp64Stdout()` with its narrow
`PACKER_NAME_RE` charset — "so a hostile standard output cannot smuggle control
characters or markup into a document a human later reads". But `evidence[].raw`
carries up to 512 bytes of the same stdout **verbatim**, with no charset filter,
and the CLI prints it into the JSON finding a human then pastes into a recon
write-up. `JSON.stringify` escapes C0 control characters, so this is not a
terminal-injection hole, but ANSI escape sequences above `\x1f`, Markdown, and
arbitrary Unicode pass through — exactly what the sanitisation of the sibling
field exists to prevent.

**Fix:** Either apply a printable-ASCII filter to `raw` before storing it, or
correct the header to say the parsed *name* reaches one field while the evidence
record deliberately preserves raw output, and state why that is safe.

```js
const raw = typeof result.stdout === "string"
  ? result.stdout.slice(0, MAX_PACKER_NAME_LENGTH * 8).replace(/[^\x20-\x7e\n]/g, "?")
  : "";
```

### WR-09: `probeUnp64()` ignores a non-zero exit status, contradicting its own contract

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:242-276`

**Issue:** The doc comment says *"A launch error, a non-zero status or a timeout
are all 'absent', never a failure."* The code checks only `probe.error` (`:254`)
and an empty banner (`:266`). A command that exits non-zero but writes anything
to stdout or stderr is accepted as an available oracle at `:276`, and is then run
against the user's binary. On the many tools that print usage to stderr and exit
`1` for an unrecognised `--version`, this makes any same-named binary on `$PATH`
an accepted oracle.

**Fix:**

```js
if (probe.error || probe.status !== 0) {
  return { available: false, command: null, version: null, reason: ... };
}
```

### WR-10: `--entropy` is neither range-checked nor refused when its value is missing

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:562-568`, `:596-601`

**Issue:** Two problems in the CLI entry:

1. `readFlag()` returns `undefined` when the next token is absent or `--`-shaped,
   so `packer-finding.mjs game.prg --entropy` and `... --entropy --foo` **silently
   drop the flag** and fall back to local measurement. That is the exact
   accepting-but-silently-dropping-an-option defect `r2000-cli.ts`'s WR-08/IN-06
   comments record as already paid for once in this repo.
2. There is no range check. Shannon entropy over bytes is 0.0–8.0, but
   `--entropy -5` and `--entropy 99` are accepted by `Number.isFinite` and drive
   an `unpacked` / `packed-unidentified` verdict from a physically impossible
   input.

**Fix:**

```js
const idx = argv.indexOf("--entropy");
if (idx !== -1 && (argv[idx + 1] === undefined || argv[idx + 1].startsWith("--"))) {
  console.error("packer-finding: --entropy requires a value");
  process.exit(1);
}
...
if (entropyRaw !== undefined && (!Number.isFinite(entropy) || entropy < 0 || entropy > 8)) {
  console.error(`packer-finding: --entropy must be a number in 0..8, got "${entropyRaw}"`);
  process.exit(1);
}
```

Apply the same 0..8 guard inside `packerFinding()` itself (`:496-508`), since the
library is callable independently of the CLI.

### WR-11: three suites and five shipped-prose citations hard-code a `.planning/phases/19-...` path that GSD archives

**File:** `src/mcp/vice/skill-attribution.test.ts:88-92`, `src/mcp/vice/r2000-upstream-audit.test.ts:44-49`, `src/mcp/vice/r2000-coverage.test.ts:66-79` and `:596-608`, `src/skills/routine-queue-walker/SKILL.md:11-13,27`, `src/skills/c64-program-recon/SKILL.md`, `src/skills/c64-memory-mapping/SKILL.md`

**Issue:** Two of the three test files call `readFileSync(MANIFEST_PATH)` at
**module scope**, unguarded — so if
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/` moves, the
whole suite fails to load with a raw ENOENT rather than a diagnosable assertion.
`r2000-coverage.test.ts` additionally reads that directory's
`evidence/coverage-reproducibility/` and phase **11**'s
`evidence/criterion1/recon-subject.regen2000proj`. Archiving a completed phase
directory is a routine, first-class GSD operation. This is a shipped-source test
suite whose liveness depends on a planning artifact's directory name.

Separately, the `ATTRIBUTION` blocks tell a reader the full upstream path *"is
recorded once, in .planning/.../upstream-procedure-manifest.json"* — a file that
ships in neither tarball. For every npm or plugin consumer, the pointer the
attribution header offers as its escape hatch is dangling.

**Fix:** Move the manifest and the sealed reproducibility evidence to a durable,
shipped-or-at-least-stable location (`docs/upstream/` or
`src/mcp/vice/fixtures/`), and reference *that* from both the tests and the
attribution headers. If the planning location must stay, resolve it through a
single exported constant with an `existsSync` guard that fails with a named
message (`"the phase-19 manifest has moved; update MANIFEST_PATH"`) rather than
an ENOENT at import.

### WR-12: `manifestEntryFor()` lies to the type system and can throw a TypeError instead of its intended message

**File:** `src/mcp/vice/skill-attribution.test.ts:230-232`, used at `:294`

**Issue:** `manifest.procedures.find(...)` returns `T | undefined`, but the
function is annotated `{ path: string; sha256: string }`. The `manifest` object
is `any` (from `JSON.parse`), so `strict` does not catch it. The only guard —
`assert.ok(manifestEntryFor(row), ...)` — lives in a *different* test
(`:258-263`); node:test runs tests independently, so the digest test at `:307`
dereferences `entry.sha256` unguarded. A re-pathed manifest entry therefore
surfaces as `TypeError: Cannot read properties of undefined` instead of the
written diagnostic.

**Fix:**

```ts
function manifestEntryFor(row: AbsorbedFile): { path: string; sha256: string } | undefined {
  return manifest.procedures.find((p: { path: string }) => p.path === row.upstreamPath);
}
// at the call site:
const entry = manifestEntryFor(row);
assert.ok(entry, `${row.destination}: manifest lists no entry for ${row.upstreamPath}`);
```

## Info

### IN-01: `r2000-coverage.ts` carries a shebang but is a pure library

**File:** `src/mcp/vice/r2000-coverage.ts:1`

**Issue:** `#!/usr/bin/env node` implies a CLI entry point. The module has none —
it exports functions only, and the CLI lives in `r2000-cli.ts`. The project's own
convention is "shebang on every standalone script", which this is not.

**Fix:** Remove line 1.

### IN-02: fixture regeneration is host-dependent despite the stated determinism contract

**File:** `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs:15-20`

**Issue:** The header states running the generator twice must leave
`git status --porcelain` empty — verified locally. But the payload comes from
`synthesizeProject()` → `gzipSync()`, and the gzip header's OS byte is set from
zlib's compile-time `OS_CODE`. Regenerating on a non-Unix host would churn all
six `project.regen2000proj` files with no source change. The determinism claim is
true per-host, not absolutely.

**Fix:** State the per-host qualifier in the header, or normalise the OS byte
after gzip so the artifact is byte-identical across platforms.

### IN-03: `stripComments()` has no regex-literal awareness

**File:** `scripts/lib/r2000-cli-verbs.mjs:59-96`

**Issue:** The scanner treats `'` and `` ` `` as string delimiters unconditionally.
A regex literal in `r2000-cli.ts` containing an apostrophe or a backtick would
open a phantom string and desync the scan, and a string literal containing an
unbalanced `{`/`}` would desync `switchVerbBody()`'s depth count. Severity is low
only because `R2000_CLI_VERB_FLOOR` turns the resulting under-count into a loud CI
failure rather than a silent one.

**Fix:** Note the limitation in the function's doc comment so a future maintainer
knows why a verb "disappeared", and reference the floor as the backstop.

### IN-04: `computeStructuralCensus` never checks that `origin + size` stays inside the 16-bit space

**File:** `src/mcp/vice/r2000-coverage.ts:335-336`

**Issue:** `origin` is clamped to `0..0xffff`, but `size` is taken from the
payload unchecked. A 64K payload at a non-zero origin produces `classRuns` whose
`end` exceeds `$ffff` and `hexAddr()` output wider than four digits — addresses
that do not exist on the machine being measured.

**Fix:** Either clamp the censused range to `min(size, 0x10000 - safeOrigin)` and
record the truncation in a stated reason, or wrap at 16 bits; either way say which
in the doc comment.

---

_Reviewed: 2026-08-24T18:33:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
