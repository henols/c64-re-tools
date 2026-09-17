---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
decision: prerequisite-declaration-provenance
date: 2026-09-17
decision_ids: [D-02, D-03, D-04, D-05, D-06, D-07, D-09, D-10, D-11]
statements_reversed:
  - document: README.md
    location: "\"What a sub-3.10 VICE costs\" (README.md:117-123)"
    original: >-
      Nothing breaks. `CPUHISTORY_GET` (the exact per-instruction cycle
      counter) is absent below VICE 3.10, so the cycle stopwatch degrades to
      an honest within-one-frame approximation instead of an exact count.
      This is already-shipped graceful degradation -- every other tool works
      the same either way.
    amended_at: "phase 58 plan 02, Task 2 -- README.md:117-123 is rewritten in the same phase this doc records the reversal"
related_decisions: [DECL-01, DECL-04]
---

This file is the one authoritative place for the reasoning behind every
`provenance` grade in `src/mcp/vice/prerequisites.json`, and for every case
where two places in this tree said different things about the same fact
before that declaration existed. The JSON's `provenance` tag is what a test
asserts on; this file is what a human reads. Nothing below restates a
citation the JSON already carries without also saying why the losing side
lost. Where a figure in this file has not been directly observed, it says so
by name rather than filling in a plausible number.

## Case one: the VICE version gate

`README.md:96-97` frames the VICE 3.10 floor as load-bearing:

> Checked live against each ecosystem on 2026-08-18. `CPUHISTORY_GET`, the
> opcode behind this project's exact cycle stopwatch, requires **VICE >= 3.10**

`.planning/REQUIREMENTS.md:85` records the opposite, and is the later
evidence:

> Reporting a VICE, ACME, Ghidra or dxa version number | No shipped tool
> refuses on one. `vice_cpu_history` runs over the text channel (`chis`); the
> VICE >= 3.10 floor is on `CPUHISTORY_GET`, an opcode no shipped tool calls

**`.planning/REQUIREMENTS.md:85` wins.** It is both the later statement (the
README prose dates to 2026-08-18; the REQUIREMENTS.md row was written for the
v1.1.0 milestone opened 2026-09-16) and the measured one: `vice_cpu_history`
is served over the text channel's `chis` command, not the binary monitor's
`CPUHISTORY_GET` opcode, so the 3.10 floor binds an opcode no shipped tool
ever calls. The consequence is structural, not cosmetic: the declaration
carries **no VICE version data of any kind** -- not a floor field, not a
dated observation string, nothing a doctor could report as a VICE version.
That is what lets `DECL-04`'s "exactly one record, `node`, carries a
`versionFloor` field" rule hold literally rather than by argument -- there is
no second version fact anywhere in `prerequisites.json` for a reader to
mistake for a floor. It is also why plan 58-02's second task exists at all:
`README.md:117-123` ("What a sub-3.10 VICE costs") sits outside the table
Phase 62 generates, nothing else will ever correct it, and it was still
asserting the losing side until this phase.

## Case two: the shared c1541/petcat remedy

The `c1541` and `petcat` refusals in `src/mcp/vice/host-tool.mts` carry no
remedy text of their own. The `c1541.*` refusal, `src/mcp/vice/host-tool.mts:1559`:

> `host_tool "${request.tool}" refuses: "c1541" does not exist (tried:
> ${c1541Found.tried.join(", ")})`

The `petcat.decode` refusal, `src/mcp/vice/host-tool.mts:1634`, is the same
shape:

> `host_tool "petcat.decode" refuses: "petcat" does not exist (tried:
> ${petcatFound.tried.join(", ")})`

Both name only the paths `findSiblingBinary()` (`src/mcp/vice/host-tool.mts:2273-2311`)
tried -- neither carries a sentence a user could act on. There is therefore
nothing to literally carry from the refusal itself, and the only remedy for
either binary anywhere in this tree is the VICE install table
(`README.md:99-108`), written for a third binary, `x64sc`. The cause is
structural: `findSiblingBinary()` resolves `c1541` and `petcat` as siblings
of whichever `x64sc` `resolvedBackend()` already found, because installing
the VICE package installs all three binaries together -- there is no
separate `c1541` or `petcat` package on any ecosystem this project has
checked. `c1541`'s and `petcat`'s `remedies` trees in `prerequisites.json`
are therefore a deliberate byte-for-byte copy of `x64sc`'s, not a
pointer/reference field, so that Phase 60's refusal wiring and Phase 62's
generator never have to resolve an indirection to answer "how do I get
`c1541`". What guards the reuse against silent drift is
`prerequisites.test.ts`'s `"D-06: x64sc/c1541/petcat share one OS package --
their linux remedy ecosystem order and text are byte-identical in all three
pairwise directions"` case: the three records' remedy texts are asserted
byte-identical to one another in every pairwise direction, so a future edit
to one that is not mirrored to the other two fails the suite rather than
drifting unnoticed.

## Case three: the scope of the one measured grade

Exactly one remedy entry in `prerequisites.json` carries `"provenance":
"measured"`: the `acme` record's `linux.ubuntu` entry, sourced from
`.github/workflows/ci.yml:78` (`retry_apt install -y acme`, inside the
`build` job that runs on the `ubuntu-latest` runner label,
`.github/workflows/ci.yml:18`). It is graded `measured` and not merely
`carried` because CI does not just run the install command -- it then proves
the installed binary really is ACME by grepping its own version banner
(`.github/workflows/ci.yml:80-81`), so this is an observed install, not an
asserted one.

**Recorded because it was directly observed, not assumed:** a live CI run
of this exact job (`build`, run `35225137192`, 2026-09-17) resolved
`ubuntu-latest` to runner image `ubuntu24/20260907.300` (Ubuntu 24.04.5 LTS),
installed `acme` version `1:0.97~svn20211115+ds-1` from the `noble/universe`
archive, and the banner grep passed against the output `This is ACME,
release 0.97 ("Zem"), 31 Jan 2021`. This is the observation the `measured`
grade is attesting to. A different run on a different day could resolve
`ubuntu-latest` to a different image or a different `acme` package version --
the `measured` grade is a claim about the *install command*, not a pin on
the image or package version, and the declaration does not carry either of
those two numbers.

The sibling `debian` entry in the same record (`.github/workflows/ci.yml:48`,
same command text `sudo apt-get install -y acme`) is graded `carried`, not
`measured`, even though the command is byte-identical. The CI comment at
`.github/workflows/ci.yml:45-50` names the distinction explicitly: that step
was "verified [as a] package name against Debian trixie during planning" --
a package-name check, never an observed install on that ecosystem. Sharing a
package manager and a command string with the one entry CI actually executes
does not promote a sibling ecosystem to `measured`; only the ecosystem the
CI job's own runner actually resolves to (`ubuntu`, via `ubuntu-latest`)
carries that grade. No other tool, platform, or ecosystem key in the
document carries `measured` -- `prerequisites.test.ts`'s
`"D-14/D-15: exactly one remedy entry in the whole document is graded
measured"` case asserts this as a relation, not a count that happens to be
one today.

## Case four: the two Node floors

Both `src/mcp/vice/package.json:102-103` (`"engines": { "node": ">=24.0.0"
}`) and `installer/package.json:15-16` (`"engines": { "node": ">=18" }`)
declare a Node floor for this project, and they differ. Both are correct
about different things, and only one of them is a fact the declaration
records.

`prerequisites.json`'s `node.versionFloor` field carries `>=24.0.0` --
`src/mcp/vice/package.json`'s number, byte-equal to it
(`prerequisites.test.ts`'s `DECL-04` case asserts this). It carries that
number and not the installer's because a shipped code path genuinely refuses
below it: `src/mcp/vice/resources/vice-launcher.sh:156` sets
`NODE_FLOOR_MAJOR=24` and `src/mcp/vice/resources/vice-launcher.sh:266` refuses to launch the broker
when the resolved `node` on `PATH` (or `VICE_BROKER_NODE`) is below that
major version. `installer/package.json`'s `>=18` is a different fact
entirely: it is the floor the **installer package itself** -- plain `.mjs`,
no type-stripping runtime dependency -- can run on, and by extension the
lowest Node a prerequisite **doctor** entry point must itself start on
(D-14). It is also the number the local Node-18 parse proof in plan 58-01
exercised live and the number `DECL-02`'s CI matrix cell
(`decl-02-node18-proof`, `.github/workflows/ci.yml`) pins, and it is the
number Phase 61's doctor cell will pin again when it runs the real doctor
entry point on the same floor. It deliberately does not become a second
`versionFloor`-shaped field anywhere in the document: the doctor's own start
floor is not a fact about a tool prerequisite the declaration exists to
report, and adding it as a field would give `DECL-04`'s "exactly one
version-floor field, and it belongs to `node`" rule a second version number
to be read against, which is precisely the ambiguity that rule exists to
foreclose. This is the case that keeps `DECL-04` from being read as "the
only Node number in the project" -- it is the only Node number *in the
declaration*, and the installer's lower number lives in `installer/package.json`
where it has always lived.

## Case five: one ecosystem under two platforms

The Homebrew row in `README.md:107` covers `macOS + Linux` in a single row,
so the `homebrew` ecosystem entry appears under both the `linux` and the
`darwin` platform keys in `x64sc`, `c1541`, and `petcat`'s `remedies` trees,
with byte-identical `text` (`"brew install vice"`) and `source`
(`README.md:107`) in both places. This is a deliberate duplication that
mirrors the source table's own scope, not two independent authoring
decisions that happen to agree, and not an error a future consumer should
try to collapse into a single cross-platform key -- the record shape (D-06)
is platform keys at the top level with ecosystems nested beneath, precisely
so a doctor can match on `process.platform` without a second lookup, and
Homebrew genuinely serves two platforms under that shape.

## Authoring decisions

Several choices were left open before this phase and were made while
writing `prerequisites.json` (plan 58-01) and this doc (plan 58-02):

- **Schema version.** The document carries `"schemaVersion": 1` at the top
  level. This project has two precedents that point opposite ways --
  `.annostore` carries a `SCHEMA_VERSION` of `4`, and `tools-manifest.stock.json`
  carries no version field at all. `prerequisites.json` follows the
  `.annostore` precedent: it is hand-authored and consumed by Phase 60's
  refusal wiring, Phase 61's doctor, and Phase 62's generator, all landing
  in later phases against a file that already exists today -- a version
  field costs one integer now and gives every future consumer of the shape
  a place to detect a breaking change, exactly as `.annostore`'s own
  precedent does.
- **`dxa`'s remedy shape.** `dxa.remedies` carries a single `universal` key
  with exactly one entry (`prerequisites.test.ts`'s `"tools.dxa.remedies has
  the single key universal with exactly one entry"` case asserts this),
  rather than the same `bash vendor/dxa/build.bash build` string repeated
  under `linux`/`darwin`/`win32`. `dxa` is vendored and built by this
  project itself (`src/mcp/vice/vendor/dxa/`), so its remedy is the same
  build command on every platform -- repeating it three times would invite
  the three copies to drift the way `x64sc`'s per-ecosystem rows
  legitimately do, when nothing about this remedy is platform-dependent at
  all. `acme-lib`, `ghidra`, and `node` follow the same `universal`-only
  shape for the same reason: an environment-variable or PATH instruction
  that does not vary by OS.
- **Cadence of the planted-violation case.** `assertNoStrayVersionFloor`'s
  planted-violation case (`prerequisites.test.ts`'s `"structural (T-58-01):
  assertNoStrayVersionFloor's planted violation is reported and the real
  document is not"`) is not a separate scheduled job or a manual audit --
  it runs inline, in the same `node --test prerequisites.test.ts` invocation
  as every other case in the file, every time that suite runs (every local
  `npm test`, every CI `build` job). There is no cadence to configure
  because the planted document is `structuredClone`d fresh inside the test
  body on every run; the guard cannot silently stop firing without the test
  file itself changing.
- **Markdown formatting in remedy text.** No remedy `text` string in
  `prerequisites.json` carries markdown code-span backticks, even though one
  of its sources -- the README install table -- does wrap commands in
  backticks (e.g. `` `sudo apt install vice` ``). `prerequisites.test.ts`'s
  README-parity case strips backticks from the source cell before comparing
  it to the JSON string
  (`.replace(/`/g, "")`) for exactly this reason: the JSON is a data field a
  doctor's plain-text report and a future refusal message both read
  directly, and neither wants to print a literal backtick to a terminal.
  Markdown formatting is Phase 62's concern, not this declaration's -- the
  generator re-adds whatever formatting the regenerated README table needs
  when it emits rows from these same strings.
- **Ordering.** The order of tool records within `prerequisites.json`'s
  `tools` object is not asserted anywhere and is not significant --
  `prerequisites.test.ts`'s own required-tools case checks a subset
  relation over `Object.keys(doc.tools)`, never an array order. The order of
  ecosystem entries *within* a platform's list **is** significant:
  `prerequisites.test.ts`'s `"tools.x64sc.remedies has exactly
  linux/darwin/win32, linux in README row order"` case asserts the `linux`
  ecosystem list is byte-order-identical to the README table's own row
  order, because Phase 62's generator is expected to walk this list and
  re-emit the table losslessly -- a re-ordered list would silently reorder
  the generated table's rows.
- **Absent remedy entries.** Not every tool carries an entry for every
  platform key. `acme`, for instance, has `linux` entries (`ubuntu`,
  `debian`) and a `universal` fallback (`"Install ACME."`,
  `src/skills/acme-build/SKILL.md:254`), but no `darwin` or `win32` key at
  all -- there is no macOS- or Windows-specific ACME install instruction
  anywhere in this tree to carry. The rule this phase establishes: an absent
  platform key is the schema's own answer for "no platform-specific remedy
  is known for this tool on this platform", and a consumer (the Phase 61
  doctor) is expected to fall back to that tool's `universal` entry when a
  platform-specific key is missing, rather than the declaration guessing a
  plausible-sounding command (a `brew install acme` this project has never
  observed or read from an upstream source) to fill the gap. `acme-lib`,
  `ghidra`, `dxa`, and `node` carry only `universal` for the same reason --
  none of their remedies vary by OS, so no OS-specific key exists to be
  either present or absent.

## The ACME library probe prefixes

`findAcmeLib()` (`src/mcp/vice/host-tool.mts:2231-2245`) is now the only
place in this tree that lists the directories this project probes for
ACME's standard library. It checks, in order: `$ACME` (the environment
variable, unconditionally first if set), then `/usr/local/share/acme`, then
`/usr/share/acme`, then `/usr/lib/acme`, then `~/.acme` (built from
`$HOME`). Each candidate is accepted only if it contains the marker file
`ACME_LIB_MARKER` (`src/mcp/vice/host-tool.mts:2205`, the relative path
`cbm/c64/vic.a`) -- a directory that exists but does not hold that file is
not treated as a match. This list has no other home in the tree since D-02:
`src/skills/acme-build/SKILL.md:211-212` states in as many words that these
prefixes are "none of them documented a second time here", so this doc is
now the one place a reader who does not want to open `host-tool.mts` can
find the current probe list. `CLAUDE.md`'s constraint list still cites
`src/skills/acme-build/SKILL.md` for "four documented prefixes" -- that
citation is stale, the correction is deliberately deferred (it needs to
touch both `CLAUDE.md` and `.planning/PROJECT.md` at once, since the former
is mirrored from the latter), and this doc does not close it.

## Citation ledger

This ledger is machine-read by `src/mcp/vice/phase58-citation-ledger.test.ts`.
Every distinct `file:line` citation in this document's body must have a
matching entry below, carrying an `anchor` -- the exact substring the cited
line range must contain. The anchor is re-asserted against the cited file's
live text on every run: adding a citation to this document without adding
its entry here, or letting an entry drift off its anchor, fails the build.

```json
[
  { "citation": ".planning/REQUIREMENTS.md:85", "anchor": "No shipped tool refuses on one." },
  { "citation": "README.md:96-97", "anchor": "Checked live against each ecosystem on 2026-08-18." },
  { "citation": "README.md:117-123", "anchor": "No shipped tool in this project refuses on a VICE version." },
  { "citation": "src/mcp/vice/host-tool.mts:1559", "anchor": "host_tool \"${request.tool}\" refuses: \"c1541\" does not exist" },
  { "citation": "src/mcp/vice/host-tool.mts:1634", "anchor": "host_tool \"petcat.decode\" refuses: \"petcat\" does not exist" },
  { "citation": "src/mcp/vice/host-tool.mts:2273-2311", "anchor": "function findSiblingBinary(" },
  { "citation": "README.md:99-108", "anchor": "| Ecosystem | Install command | Version it ships | Clears the 3.10 gate? |" },
  { "citation": ".github/workflows/ci.yml:78", "anchor": "retry_apt install -y acme" },
  { "citation": ".github/workflows/ci.yml:18", "anchor": "runs-on: ubuntu-latest" },
  { "citation": ".github/workflows/ci.yml:80-81", "anchor": "grep -qi acme /tmp/acme-banner.txt" },
  { "citation": ".github/workflows/ci.yml:48", "anchor": "verified package name against" },
  { "citation": ".github/workflows/ci.yml:45-50", "anchor": "verified package name against" },
  { "citation": "src/mcp/vice/package.json:102-103", "anchor": "\"node\": \">=24.0.0\"" },
  { "citation": "installer/package.json:15-16", "anchor": "\"node\": \">=18\"" },
  { "citation": "src/mcp/vice/resources/vice-launcher.sh:156", "anchor": "NODE_FLOOR_MAJOR=24" },
  { "citation": "README.md:107", "anchor": "brew install vice" },
  { "citation": "src/mcp/vice/host-tool.mts:2231-2245", "anchor": "function findAcmeLib()" },
  { "citation": "src/mcp/vice/host-tool.mts:2205", "anchor": "ACME_LIB_MARKER = join(\"cbm\", \"c64\", \"vic.a\")" },
  { "citation": "src/skills/acme-build/SKILL.md:211-212", "anchor": "documented a second time here" },
  { "citation": "src/skills/acme-build/SKILL.md:254", "anchor": "Install ACME." },
  { "citation": "src/mcp/vice/resources/vice-launcher.sh:266", "anchor": "NODE_MAJOR\" -lt \"$NODE_FLOOR_MAJOR\"" }
]
```
