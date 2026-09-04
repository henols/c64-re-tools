# Phase 35: dxa, Vendored and Parsed - Research

**Researched:** 2026-09-04
**Domain:** Vendoring and building a small (3,417-line) GPLv2+ C tool at a pinned
version, spawning it through Phase 34's host-tool execution seam, and owning a
listing parser (and its refusal behaviour) that dxa itself does not provide.
**Confidence:** HIGH — every load-bearing fact below is either read directly from
a source file this session or reproduced from Phase 23's committed evidence.
No web research was performed (per the research-scope directive: "This is
implementation").

## Summary

Phase 35 has almost no open technical questions about dxa itself — Phase 23
already fetched it, pinned it, built it, ran it three ways, and reproduced its
own listing parser against a rebuilt fixture. What Phase 35 must do is
**productionise** that throwaway evidence: move the vendoring, the build, the
parser and its refusal behaviour from `.planning/phases/23-.../evidence/` (a
disposable probe directory, explicitly forbidden from touching `src/`) into
`src/mcp/vice/`, wired through the host-tool execution seam Phase 34 built, and
covered by real tests rather than a transcript.

Three structural facts drive the plan shape more than any dxa-specific fact
does. First, Phase 34's own test suite **already names the two production
modules this phase must create** — `dxa-listing.ts` and `dxa-run.ts` — as a
named-absence assertion in `hostpath-consumers.test.ts`, and pins a
`HOST_TOOL_FAMILY_FLOOR` that a plan adding those two files must raise from 3 to
5 in the same commit. Second, `host-tool.mts`'s `HostToolId` union is a closed,
four-member type (`"acme.build" | "ghidra.analyze" | "oracle.probe" |
"oracle.run"`) with no `dxa.*` member yet; adding one is a small, precisely
patterned change (allowlist entry, arg-key entry, path-arg-key entry, a
`ResolvedDxaXArgs` interface, a `buildHostToolArgv()` branch, a timeout entry)
that mirrors `acme.build` almost exactly, because both tools are "spawn a CLI,
digest the files it wrote." Third, `THIRD-PARTY-NOTICES.md` currently states,
in its own voice, **"No GPL-licensed material is incorporated into this
package"** — vendoring dxa's GPLv2+ source makes that sentence false, and the
plan must edit it in the same commit that adds the vendored tree, or the
notices file becomes a shipped, self-contradicting claim.

The genuinely open design problem is `DXA-04`'s ground-truth partition. Phase
23's own W/C/D/U measurement scheme (`SCHEMA.md` §4) is **execution-derived** —
its data set comes from VIC-pointer values read from a live chip-state
snapshot and its code set comes from VICE runtime observation of what actually
executed. `DXA-04` explicitly forbids that route ("derived from the image
bytes, not from execution, `memmapshow` being stated absent"). This research
proposes a narrower, purely byte-derived script (§ Ground-Truth Partition
below) and states plainly what it can and cannot decide.

**Primary recommendation:** vendor dxa's source (not just its binary) under
`src/mcp/vice/vendor/dxa/`, gate the build behind a `sha256`-checked,
idempotent shell script in the `ensure-mcp-deps.sh` style (never committing the
built binary), add a fifth `HostToolId` member (`"dxa.disassemble"`) following
`acme.build`'s exact pattern in `host-tool.mts`, port
`evidence/dxa-listing-parse.mjs` into `dxa-listing.ts` with its one regex and
its refusal intact, and write `DXA-04`'s partition script as a **strict,
abstaining** classifier — BASIC-stub bytes and the `.prg` load-address header
are the only source-independent certainties this phase can claim on a real
release with no source and no execution.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DXA-01 | Vendor dxa at a pinned version, build it, GPLv2+ notice quoted from source headers | § Standard Stack, § Code Examples ("The GPL header, quoted verbatim"), § Common Pitfalls (Pitfall 1: THIRD-PARTY-NOTICES.md's false negative) |
| DXA-02 | Parse dxa's listing into a machine-readable map; refuse by name, not via dxa's exit status; overlapping decodes → `unclassified` | § Code Examples ("The listing parser, ported"), § Common Pitfalls (Pitfall 2, 3), § Validation Architecture |
| DXA-03 | Known-data ranges → `-b` blocks, sourced from the store's 12-member vocabulary, exercised on a real image | § Architecture Patterns ("The store-to-dxa emitter"), § Don't Hand-Roll |
| DXA-04 | Ground-truth partition from a committed script, before dxa runs, no execution oracle | § Ground-Truth Partition (below), § Common Pitfalls (Pitfall 4) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| dxa build (fetch, verify, `make`) | Host process (spawned via broker) | — | dxa is a native binary; it cannot run inside the MCP server's Node process or the container. It is provisioned exactly like ACME already is for `acme.build` |
| dxa invocation (`-a dump`, `-b`, `-B`, `-R`) | Host-Tool Execution Seam (`host-tool.mts`) | — | SEAM-01/02/03: a stateless, typed, allowlisted child-process invocation on the broker's control socket. Never a container-side `spawnSync` |
| Listing parsing + refusal | Container-side / API-Backend (`dxa-listing.ts`) | — | Pure text-to-structure transform; no host access needed once the listing file is on the container side (via `containerPath()`) |
| Ground-truth partition (`DXA-04`) | Container-side, offline script | — | Runs on the image bytes (or the fixture's own assembler report) BEFORE dxa is invoked at all; no host process, no VICE |
| Data-block emission (`-b`/`-B`/`-l`, `DXA-03`) | Container-side (`.annostore` reader) → Host-Tool Seam | Store (`.annostore`) | The store is queried container-side for the 12-member-vocabulary ranges; the resulting `-B`/`-l` files are then handed to dxa exactly like `-R` entry points already are in Phase 23's flag set |
| Vendored source + licence notice | Repository / Packaging | — | `src/mcp/vice/vendor/dxa/`, `THIRD-PARTY-NOTICES.md`, `package.json files[]` — none of this is a runtime capability, it is packaging/provenance |

## Standard Stack

### Core

| Component | Version | Purpose | Why fixed |
|---|---|---|---|
| dxa | **0.1.5** | The discovery engine — the only tool in this milestone that turns raw bytes into a code/data split at all | `[VERIFIED: .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/TOOLS.txt — DXA_VERSION: 0.1.5, DXA_TARBALL_SHA256: 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799, DXA_TARBALL_SHA256_VERIFIED: yes, DXA_BINARY_SHA256: 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523]`. Source: `https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz`, 37,987 bytes, 25 Mar 2022 |
| Node.js `node:fs`/`node:crypto` (sha256) | built-in | Digest gate (fetch pin + build-reproduction pin) | This project has zero new runtime dependencies for this phase — `dxa-listing.ts` has exactly one regex and no third-party parser, per `dxa-listing-parse.mjs`'s own header comment |

### Supporting

| Component | Version | Purpose | When to use |
|---|---|---|---|
| GNU `make` + `gcc` | host toolchain, unpinned | Builds dxa from source (`gcc -Wall -Wmissing-prototypes -O2 -c ...` per file, then link) | `[VERIFIED: instrument-provenance.txt lines 65-73, the exact make transcript]`. No `configure`, no autotools — a bare `Makefile` |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Vendoring dxa's C source and building it | Assuming a system `dxa`/`xa65` package | **Rejected, already measured**: `dpkg -L xa65` ships no `dxa` binary on this host, and dxa 0.1.5 is "not part of the official xa distribution yet" per its own `INSTALL` file (`grep -n -i alpha INSTALL` → `INSTALL:15`, `[VERIFIED: instrument-provenance.txt:112-126]`). `DXA-01`'s text itself already forecloses this ("never one assumed present on `$PATH`") |
| Hand-porting `dxa-listing-parse.mjs`'s logic | A third-party assembly-listing parser library | No such library exists for dxa's specific `-a dump` grammar; it is a 5-line-shape, one-regex format this project already owns end to end |

**Installation (vendored build, not npm):**

```bash
# Fetch pin written BEFORE the fetch (Phase 23's convention, reused):
echo "8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799  dxa-0.1.5.tar.gz" \
  > src/mcp/vice/vendor/dxa/dxa-0.1.5.tar.gz.sha256

curl -fsSL -o /tmp/dxa-0.1.5.tar.gz \
  https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz
sha256sum -c src/mcp/vice/vendor/dxa/dxa-0.1.5.tar.gz.sha256   # against the downloaded file
tar xzf /tmp/dxa-0.1.5.tar.gz -C src/mcp/vice/vendor/dxa/ --strip-components=1
( cd src/mcp/vice/vendor/dxa && make )
sha256sum src/mcp/vice/vendor/dxa/dxa   # must equal 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523
```

**Version verification:** `DXA-01`'s criterion 1 requires re-verifying the
Phase 23 pin **byte-for-byte** and asserting the build **reproduces the same
binary digest** (`0e2bf1a5…8523`). Because dxa ships no upstream signature or
checksum of its own, the only corroboration is the independent FreeBSD ports
`devel/dxa65` `distinfo` file, already cross-checked in Phase 23
(`23-RESEARCH.md:344`, `[CITED: FreeBSD ports devel/dxa65 distinfo, cross-checked 2026-08-26]`).
No newer dxa release exists to check against — the project is dormant since the
2022-03-25 tarball (`[VERIFIED: instrument-provenance.txt:46-63]`, file mtimes).

## Package Legitimacy Audit

**Not applicable in the npm/PyPI/crates sense.** This phase vendors a C source
tarball fetched directly over HTTPS with a `sha256` pin, not a package from any
registry the `package-legitimacy check` seam covers. No new npm, PyPI, or
crates dependency is introduced by this phase — `dxa-listing.ts`, `dxa-run.ts`
and the ground-truth partition script all use Node built-ins only, matching
`dxa-listing-parse.mjs`'s own "does NOT import from any module under `src/`"
discipline extended to "and no new npm dependency, ever" for this specific
tool. The supply-chain-equivalent checks for a vendored source tarball are
recorded below, all already performed and cited above:

| Signal | Value | Verdict |
|---|---|---|
| Source | `https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz` (upstream author Cameron Kaiser, xa65 maintainer) | Named, single-maintainer, corroborated |
| Independent checksum corroboration | FreeBSD ports `devel/dxa65` distinfo records the identical sha256 | Corroborated (no upstream signature exists to check instead) |
| Self-declared maturity | `INSTALL:15`: *"this is still considered 'alpha' software and there may be bugs, which is why it is not part of the official xa distribution yet"* | Recorded, not a blocker — `DXA-02`'s whole refusal requirement exists because of exactly this immaturity |
| Postinstall / build scripts | Plain `Makefile`, `gcc` compile + link, no configure-time code execution, no network access during build | Clean |
| Licence file present in tarball | **No** — `ls -a dxa-0.1.5/ \| grep -Ei 'sig\|asc\|sha\|md5\|sum\|licen\|copying'` returns nothing | This is `DXA-01`'s named packaging gap, not a defect to fix — the notice must be quoted from source headers instead |

**Packages removed due to `[SLOP]` verdict:** none — no registry package is
introduced by this phase.
**Packages flagged as suspicious `[SUS]`:** none.

## Architecture Patterns

### System Architecture Diagram

```
 caller (skill script or CLI, container-side)
   │
   │ 1. "give me a code/data map for this image"
   ▼
 anno-cli.ts (or a new `dxa disassemble <image>` verb, TBD by the plan)
   │
   │ 2. resolve known-data ranges from .annostore (DXA-03)
   ▼
 store reader (existing anno-* seam) ──► emits -B/-l data-block files
   │                                          │
   │ 3. build ground-truth partition BEFORE   │
   │    dxa runs at all (DXA-04)              │
   ▼                                          │
 dxa-partition script (new, offline,          │
 image-bytes-only, no execution)              │
   │                                          │
   │ 4. host_tool control op, tool:           │
   │    "dxa.disassemble"                     │
   ▼                                          ▼
 host-tool-client.ts → broker-control.mts (SEAM-01, stateless, no lease)
   │
   │ 5. spawn vendored dxa binary with typed argv
   │    (-g 0000 -p all-nmos6502 -d ... -t ... -R <entrypoints>
   │     -B <datablocks> -a dump)
   ▼
 host-tool.mts::runHostTool()  (host side, real process)
   │
   │ 6. dxa writes its listing to a file; host-tool.mts digests it
   │    { path, sha256, byteLength } -- never raw bytes over the wire
   ▼
 dxa-run.ts (container side) ← containerPath() translation
   │
   │ 7. read the listing file, hand it to the parser
   ▼
 dxa-listing.ts::parseDumpListing()
   │
   │ 8a. accounted bytes === image size → machine-readable code/data map
   │ 8b. accounted bytes !== image size → THROW, named refusal (DXA-02)
   ▼
 caller receives { code: Set<addr>, data: Set<addr>, unclassified: [...] }
   or a thrown, named refusal error
```

### Recommended Project Structure

```
src/mcp/vice/
├── vendor/
│   └── dxa/                  # vendored source (NOT the built binary), pinned
│       ├── dxa-0.1.5.tar.gz.sha256   # written BEFORE fetch (DXA-01 criterion 1)
│       ├── *.c, *.h, Makefile, dxa.1, INSTALL, ChangeLog  # unpacked tarball contents
│       └── build.bash        # NOT build.sh -- see Pitfall 3 (EXPECTED_TRACKED_SHELL_SCRIPTS)
├── dxa-listing.ts            # the ONE -a dump parser + refusal (DXA-02).
│                              # Named by hostpath-consumers.test.ts BEFORE it exists.
├── dxa-run.ts                # container-side orchestration: calls
│                              # runHostToolFromContainer({tool:"dxa.disassemble",...}),
│                              # reads the digested listing file, hands it to dxa-listing.ts.
│                              # Named by hostpath-consumers.test.ts BEFORE it exists.
├── dxa-partition.ts           # DXA-04's ground-truth script. Runs BEFORE dxa,
│                              # takes only image bytes (+ optional source report
│                              # for the fixture case) as input.
├── host-tool.mts              # MODIFIED: HostToolId gains "dxa.disassemble";
│                              # HOST_TOOL_ARG_KEYS / HOST_TOOL_PATH_ARG_KEYS /
│                              # buildHostToolArgv() / HOST_TOOL_TIMEOUT_MS gain
│                              # matching entries, mirroring the acme.build branch.
├── THIRD-PARTY-NOTICES.md     # MODIFIED: the "No GPL-licensed material..."
│                              # sentence must go; dxa's GPLv2+ notice, quoted
│                              # from source headers, must be added.
└── hostpath-consumers.test.ts # MODIFIED: HOST_TOOL_FAMILY_FLOOR 3 → 5.
```

### Pattern 1: A fifth `HostToolId`, mirroring `acme.build`

**What:** `dxa.disassemble` is, like `acme.build`, "spawn a CLI with a fixed
flag skeleton plus caller-supplied path arguments, then digest the file(s) it
wrote." It is not like `ghidra.analyze` (long-lived JVM concerns, `-deleteProject`,
dot-prefixed-path refusal) or `oracle.*` (zero caller-supplied config at all).
**When to use:** Any time this phase needs to invoke the vendored `dxa` binary.
**Example, following the exact shape at `host-tool.mts:109-116` and `:141-181`:**

```typescript
// Source: src/mcp/vice/host-tool.mts, existing HostToolId union and
// HOST_TOOL_ARG_KEYS (read this session; the four current members and their
// exact key lists are quoted verbatim, not paraphrased):
//
//   export type HostToolId = "acme.build" | "ghidra.analyze" | "oracle.probe" | "oracle.run";
//   "acme.build": Object.freeze(["source", "outDir", "format", "setpc", "defines", "includes", "noReport"]),
//
// A fifth member follows the identical pattern -- one HostToolId string
// literal, one HOST_TOOL_ARG_KEYS entry, one HOST_TOOL_PATH_ARG_KEYS entry,
// one Resolved*Paths interface, one buildHostToolArgv() branch, one
// HOST_TOOL_TIMEOUT_MS entry. Exact field names are the plan's to choose --
// this shows the SHAPE, not literal field names the source has not yet fixed.
export type HostToolId =
  | "acme.build"
  | "ghidra.analyze"
  | "oracle.probe"
  | "oracle.run"
  | "dxa.disassemble";

// HOST_TOOL_ARG_KEYS["dxa.disassemble"]: candidate fields, drawn from
// SCHEMA.md section 6's fixed flag set (source: Phase 23, quoted below) --
// image, entrypointsPath (-R), datablocksPath (-B), outDir. All four are
// path-bearing and therefore ALSO belong in HOST_TOOL_PATH_ARG_KEYS, exactly
// as acme.build's source/outDir/includes do today.
```

`[VERIFIED: src/mcp/vice/host-tool.mts:109-181 — the `HostToolId` union, `HOST_TOOL_ARG_KEYS`, and `HOST_TOOL_PATH_ARG_KEYS` literals quoted above are read directly from that range this session]`

### Pattern 2: The fixed dxa flag set

**What:** Phase 23 pre-committed a specific invocation before any corpus
measurement existed, precisely so the flags could not be chosen after seeing
which set flattered the result. Reuse it verbatim; do not re-derive.
**When to use:** every `dxa.disassemble` invocation this phase makes against a
real image.

```
dxa -g 0000 -p all-nmos6502 -d skip-scanning -t detect-internal \
    -R <entrypoints> -B <datablocks> -a dump
```

| Flag | Why fixed |
|---|---|
| `-g 0000` | Mandatory — without it dxa reads the flat capture's processor-port bytes ($2F $37) as a little-endian load address and re-bases to `* = $372f`, discarding ~50K |
| `-p all-nmos6502` | The narrower instruction sets exclude exactly the illegal opcodes crack code uses |
| `-d skip-scanning` | dxa's default `-d poor` is a large code-side bias over unreferenced RAM |
| `-t detect-internal` | The primary run; a **second** invocation with `-t detect-all` is run alongside it and both numbers are reported, never one chosen after the fact |
| `-R <entrypoints>` | VICE-observed entry points — non-circular, never from dxa or Ghidra |
| `-B <datablocks>` | `DXA-03`'s route: known-data ranges from the store, excluding `$0000-$01FF`, `$D000-$DFFF` and anything the inventory shows unwritten |
| `-a dump` | Every byte-emitting line is prefixed with its actual bytes — counts are read, not inferred from mnemonic length |

`[VERIFIED: .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/SCHEMA.md:242-270 — the flag table and listing-parser regex are quoted verbatim from that section]`

### Pattern 3: The store-to-dxa emitter (`DXA-03`)

**What:** No `-B`/`-l` emitter exists yet anywhere in `src/` — `git ls-files` /
`grep -rlai dxa src/` (NUL-byte-safe) both return nothing under `src/mcp/vice`
except the anticipatory test-file references already covered above. This phase
creates it.
**When to use:** Before every `dxa.disassemble` call on a real image, so
known-data ranges (screen, charset, sprite pointers, any range the annotation
store already classifies) are excluded from discovery rather than re-guessed.
**The 12-member source vocabulary**, quoted verbatim:

```typescript
// Source: src/mcp/vice/anno-types.ts:213-226 (read this session)
export const DATA_TYPES = Object.freeze([
  "code",
  "byte",
  "word",
  "address",
  "petscii",
  "screencode",
  "lo_hi_address",
  "hi_lo_address",
  "lo_hi_word",
  "hi_lo_word",
  "external_file",
  "undefined",
] as const);
```

`[VERIFIED: src/mcp/vice/anno-types.ts:213-226]`

`DXA-03`'s emitter reads every store row whose `dataType` is one of the
non-`"undefined"`, non-`"code"` members above (bytes the store already knows
are data, not program), and writes:

- a **`-B` datablocks file**: `dxa.1`'s documented grammar (from Phase 23's
  own read of the man page) is one `xxxx-yyyy` range per line, with `!` meaning
  "no vectors point here" and `?` meaning "wholly unused" — the emitter needs
  only the plain range form for `DXA-03`'s purpose;
- a **`-l` labels/symbols file**, if the plan chooses to seed dxa's own label
  names from the store's existing `sym`-carrying rows (optional — `DXA-03`'s
  text requires only the `-B`/`-l` **route** exist and be exercised, not that
  every store row round-trips through it).

**Exercised on a real image** means: run this emitter against the danish
corpus's known ranges (screen matrix / charset / sprite pointers, once
`AUTO-06`-style VIC derivation exists — or, for this phase alone, any range
the operator hand-annotates before the run) and confirm those bytes are absent
from dxa's `-a dump` code/data classification, not merely that the emitter
produces syntactically valid output.

### Anti-Patterns to Avoid

- **Spawning dxa directly from a skill script or from `dxa-run.ts` via
  `child_process.spawn`.** SEAM-05's whole-tree grep gate exists to ban
  exactly this — `dxa` is already in `BANNED_COMMAND_SHAPES`
  (`[VERIFIED: STATE.md:1021 — "SEAM-05's BANNED_COMMAND_SHAPES includes ... dxa ..."]`).
  Every invocation MUST go through `host-tool-client.ts` → `host-tool.mts`.
- **Committing the built `dxa` binary.** Ghidra's own phase (36) already
  recorded the house style for this class of artifact: *"build the `.sla`, do
  not commit it."* The same applies here — commit the pinned source and the
  build script, not the compiled output, which is host-architecture-specific
  and reproducible on demand from the pin.
- **Treating dxa's exit status as the refusal signal.** MEASURED: `-d strict`
  exits **0** on an inconsistent fixture (ROADMAP criterion 2). The refusal is
  `dxa-listing.ts`'s own thrown error on a byte-total mismatch, never dxa's
  process exit code.
- **Picking a winner on an overlapping decode.** A `jsr` into a mid-instruction
  target cannot be represented by a byte-per-address map — `DXA-02` requires
  `unclassified` with a stated reason, never a forced choice.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Disassembling 6502 code with heuristic code/data separation | A second disassembler, or reimplementing dxa's scanning logic | The vendored dxa binary itself | 3,417 lines of C already doing exactly this, GPLv2+, free to vendor. Reimplementing it would be strictly worse and would duplicate the "data called code" error direction this project already understands |
| A `-a dump` listing parser | A generic assembly-listing grammar (ANTLR, a hand-rolled recursive-descent parser) | The ONE regex `^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$` plus a `.byt`/`.word` text-prefix classifier | Already proven correct against the rebuilt fixture (`PARSE_ACCOUNTED_BYTES: 279` matching exactly) and against a truncated negative control. A generic grammar is unneeded complexity for a five-line-shape, single-tool-specific format |
| Verifying the vendored binary's provenance | A custom signature/checksum infrastructure | Plain `sha256sum -c` against a pin written before the fetch, cross-checked once against FreeBSD ports `distinfo` | dxa publishes no signature of its own; building anything more elaborate than a pinned digest check would imply a guarantee the upstream project itself does not offer |
| Ground-truth for dxa's rates | Trusting dxa's own reassembly round-trip, or the pivot's published numbers | A committed, independent partition script (`DXA-04`) | The round-trip self-check is measured **unavailable** in the illegal-opcode mode this project needs (Phase 23 Pitfall 4's round-trip note); the pivot's published 141/138 partition is measured **not source-derivable** |

**Key insight:** every "don't hand-roll" item above already has a Phase 23
artifact proving the simpler alternative works. The temptation this phase must
resist is re-deriving any of it from scratch instead of porting the existing,
already-verified probe code.

## Ground-Truth Partition (`DXA-04`) — the genuinely open design item

`DXA-04`'s constraint is stricter than Phase 23's own W/C/D/U scheme
(`SCHEMA.md` §4): that scheme's `D` (certain-data) set comes from **VIC-pointer
derivation off a live chip-state snapshot** and its `C` (certain-code) set
comes from **VICE runtime observation** of what actually executed
(`INV_SOURCE: vice-runtime-observation`, `[VERIFIED: SCHEMA.md:276-277]`). Both
are execution-derived. `DXA-04` explicitly forbids that route: *"Stated
without an external oracle — it is derived from the image bytes, not from
execution, `memmapshow` being stated absent."* This is a materially different,
narrower problem than the one Phase 23 already solved.

**What IS source/byte-derivable, with no execution and no external oracle:**

1. **For the 279-byte fixture specifically** (source `fixture.a` is committed
   at `.planning/notes/dxa-ghidra-pivot-evidence/fixture.a`): re-derive the
   partition from the assembler's own `-r` report, exactly as
   `evidence/fixture/fixture-baseline.mjs` already does. This is genuinely
   "a committed script that ran before dxa did" and needs no VICE, no chip
   state, and no execution — it reads ACME's report of what each source line
   emitted. Already measured: `GT_CODE_BYTES: 145`, `GT_DATA_BYTES: 131` (strict)
   / `134` (with 3 bytes of assembler pad folded into data),
   `[VERIFIED: evidence/fixture/fixture-baseline.txt, "OUTCOME LINES" section — FIXTURE_TOTAL_BYTES: 279, FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134), FIXTURE_FALSE_POSITIVES: 3, FIXTURE_FALSE_NEGATIVES: 27.61 (37/134), FIXTURE_REPRODUCED: no]`.
   This script already exists (as throwaway evidence) and only needs porting
   into `src/`, generalising past the fixture's specific directive vocabulary
   if the plan wants it to run against other ACME sources.

2. **For a real cracked release with NO source available** (the corpus case —
   `danish.d64`/`saeger.d64`), only a much smaller set of facts are provable
   from bytes alone with no execution:
   - The `.prg` format's **2-byte load-address header** is definitionally not
     part of the loaded image — excluded from the partition's denominator
     entirely, not classified either way.
   - **A BASIC loader stub**, if the load address is `$0801`: the C64 BASIC
     tokenised-line format is a fully documented, source-independent byte
     grammar (link-address word, line-number word, tokens, `$00` line
     terminator, `$00 $00` program-end marker). Bytes covered by a
     successfully-parsed BASIC stub are **certain data** — they are never
     6502 instructions, by construction of how the KERNAL's BASIC interpreter
     consumes them. The fixture's own listing shows this exact case: `0801 0b
     08 0a / 00 9e 32 / 30 36 34 / 00 00 00` is dxa's own `.byt` classification
     of a `"10 SYS 2064"` stub (`[VERIFIED: fixture-baseline.txt, the `-a
     dump` transcript's first four `.byt` lines and the `; 12 byte BASIC
     header.` comment immediately above them]`).
   - **Nothing else about a real release is decidable this way.** A
     screen-matrix or charset region conventionally sits at `$0400`/`$1000`,
     but that convention is not universal, and asserting it without either
     source or execution would be exactly the "silent guess" `DXA-04`'s own
     text warns against ("A partition that silently guesses is worse than
     one that abstains" — the research-scope directive's framing, matched by
     this project's own `unclassified`-not-a-winner discipline in `DXA-02`).

**Recommended `DXA-04` design:**

- **Positive class: `data`** (keeps continuity with Phase 23's own framing,
  so Phase 38's comparisons remain apples-to-apples in vocabulary even where
  the derivation method differs).
- **Denominator: bytes this script can prove, not the whole image.** Two
  tiers, both printed, neither chosen after the fact:
  - `PARTITION_SOURCE_DERIVED` (fixture-class inputs where an ACME source and
    its `-r` report are available) — the full Phase-23-style partition, ported
    verbatim.
  - `PARTITION_BYTE_DERIVED` (real-release-class inputs with no source) — only
    the `.prg` header exclusion and the BASIC-stub certain-data bytes, with
    **every other byte reported `unknown`** and excluded from both the
    denominator and any rate.
- **What it cannot decide, stated explicitly in its own output:** everything
  past the BASIC stub — the actual game/cracktro code and its data — is
  `unknown` under the byte-derived tier. This is a small, honest ground truth
  (tens of bytes on a typical release, not hundreds), and the research-scope
  directive's own framing applies: state the denominator, state the positive
  class, and let the smallness of the byte-derived tier be visible rather than
  padded out with a guess.
- **Checkability independent of dxa:** a unit test constructs a synthetic
  `.prg` with a known, hand-built BASIC stub (mirroring the fixture's own
  `.byt` bytes) and asserts the partition script classifies exactly those
  bytes as certain-data and nothing else — checkable with zero dependency on
  dxa's own output, satisfying the Validation Architecture's requirement
  below.

This is not `PROOF-01`. Any rate this phase computes against the byte-derived
partition on a real release is this phase's `DXA-04` deliverable (the
partition script and its discipline), not a data-recovery-rate claim about
dxa — that claim, on real cracked code, belongs to Phase 38 per the ROADMAP
note, and this research does not compute or imply one.

## Common Pitfalls

### Pitfall 1: `THIRD-PARTY-NOTICES.md` currently states a claim this phase falsifies

**What goes wrong:** `src/mcp/vice/THIRD-PARTY-NOTICES.md` opens with **"No
GPL-licensed material is incorporated into this package: no GPL-licensed
material appears anywhere in `@henols/vice-mcp`'s source or its published
tarball."** Vendoring dxa's GPLv2+ source under `src/mcp/vice/vendor/dxa/`
makes this sentence false the moment it lands, whether or not the vendored
tree is included in the npm `files[]` — the sentence claims nothing appears
*anywhere in the source*, not merely in the published tarball.
`[VERIFIED: src/mcp/vice/THIRD-PARTY-NOTICES.md, opening paragraph, read this session]`

**How to avoid:** edit that sentence and add a dxa section, quoting the GPL
header text verbatim from the vendored source (below), in the **same commit**
that adds `vendor/dxa/`.

### Pitfall 2: no `LICENSE`/`COPYING` file exists in the tarball — the notice must be hand-assembled from per-file headers

**What goes wrong:** a reader might look for a single canonical licence
statement to copy and not find one. `ls -a dxa-0.1.5/` names no `LICENSE` or
`COPYING` file `[VERIFIED: instrument-provenance.txt:105-110]`.

**How to avoid:** quote the per-file GPL header directly. All six `.c` files
carry materially the same GPLv2-or-later header text, differing only in the
per-file copyright years/holders. `main.c`'s header, read this session:

```
/*\
 *  dxa -- symbolic 65xx disassembler
 *
 *  Based on d65 Copyright (C) 1993, 1994 Marko M\"akel\"a
 *  Changes for dxa (C) 2005-2019 Cameron Kaiser
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
 *
 *  Marko does not maintain dxa, so questions specific to dxa should be
 *  sent to me at ckaiser@floodgap.com.
 *
\*/
```

`[VERIFIED: /home/henrik/.cache/c64-re-tools/phase23/dxa-0.1.5/main.c:1-24, read directly this session from the extracted, sha256-verified tarball. Not yet vendored into the repository — this is the exact text a Phase 35 plan must copy into THIRD-PARTY-NOTICES.md and, per DXA-01, the project must additionally supply the full GPL-2.0 licence text itself, since no LICENSE/COPYING file exists to quote.]`
Copyright years/holders vary slightly per file (`table.c`/`vector.c` carry only
the 1993-94 Mäkelä copyright with no Kaiser line; `scan.c`/`label.c` carry
`Copyright (C) 2019 Cameron Kaiser`); the notice should either quote one
representative header and note the variance, or quote all six — the plan's
choice, but the variance itself must not be silently flattened.

### Pitfall 3: `EXPECTED_TRACKED_SHELL_SCRIPTS` will trip on a `build.sh`

**What goes wrong:** `host-scripts.test.ts:202-208` pins the tracked
`*.sh` set to exactly 5 entries via `git ls-files -- "*.sh"`
`[VERIFIED: src/mcp/vice/host-scripts.test.ts:202-208 — the array literal contains exactly `src/mcp/vice/resources/vice-launcher.sh`, `scripts/ensure-mcp-deps.sh`, `scripts/package.sh`, `scripts/release-assets.sh`, `.planning/phases/29-.../29-15-e2e.sh`]`.
A committed `build.sh` for dxa adds a sixth tracked `.sh` file and reds this
test, exactly as Phase 23's own `task1-verify-*.sh` files did before being
renamed to `.bash` (`[VERIFIED: instrument-provenance.txt:545-565]` — the same
class of mistake, already made and already fixed once in this project).

**How to avoid:** name the build script `build.bash` (matching Phase 23's own
precedent), or add it to `EXPECTED_TRACKED_SHELL_SCRIPTS` deliberately in the
same commit — the `.bash` extension is the path of least friction and matches
established project practice.

### Pitfall 4: a `vendor/dxa/` test directory needs its own CI step in the same commit, or lives inside `src/mcp/vice` instead

**What goes wrong:** `ci-suite-coverage.test.ts` walks the **entire repository**
for any directory containing a `*.test.(ts|mts|mjs|js)` file and fails if that
directory has no registered coverage. Its `SKIP_DIR_NAMES` list does **not**
include `vendor` `[VERIFIED: src/mcp/vice/ci-suite-coverage.test.ts:58-64 — the object's five keys are exactly `node_modules`, `.git`, `dist`, `tools`, `.planning`]`,
and its `FROZEN_REGISTRY` has exactly two entries, `"src/mcp/vice"` and
`"installer"` `[VERIFIED: src/mcp/vice/ci-suite-coverage.test.ts:161-164]`. A
committed test file directly under `vendor/dxa/` (e.g. a smoke test of the
build) would be `unregistered` and fail this gate.

**How to avoid:** put every test this phase writes — the parser tests, the
partition-script tests, the host-tool-seam wiring tests — under
`src/mcp/vice/*.test.ts` (already covered by the `FROZEN_REGISTRY["src/mcp/vice"]`
entry, `proof: "npm test"`), never under `vendor/dxa/`. If a live-dxa-binary
integration test is wanted, it still belongs under `src/mcp/vice/` and in
`MANUAL_ONLY_TESTS` (see Validation Architecture below), not in a new,
separately-registered directory.

### Pitfall 5: `check-npm-packages.mjs`'s leak checks do not see `vendor/`

**What goes wrong:** the leak assertions catch `node_modules/`, `*.test.*`
files, `fixtures/` and `test-corpus.mjs` `[VERIFIED:
src/mcp/vice/host-tool.mts... actually see scripts/check-npm-packages.mjs:93-102 —
the four checks are `nodeModulesHits`, `testFileHits`, `fixturesHits` (prefix
`fixtures/`), `testCorpusHits`]`. None of these patterns matches
`vendor/dxa/*.c`. Whether the vendored C source ships inside the published
`@henols/vice-mcp` tarball is therefore **not something any existing gate
decides for you** — it is a deliberate `files[]` choice the plan must make and
state.

**How to avoid:** decide explicitly (recommended: **do not** ship the vendored
C source in the published npm tarball — it is build-time-only input on the
maintainer's machine, analogous to how `package-lock.json` is committed but
not published via `files[]`). If the built `dxa` binary needs to reach
consumers at all, that is a separate distribution question this phase's own
notes flag as unresolved by any existing guard.

### Pitfall 6: the two new `dxa-*` modules must never import `hostpath.ts` directly

**What goes wrong:** `hostpath-consumers.test.ts` maintains a closed,
five-member consumer list for `hostpath.ts` and a **second**, independently
pinned floor over the `host-tool|ghidra|dxa` prefix union specifically so a
family member that wrongly imports `hostpath.ts` produces visible red
`[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:403-419]`. Both
`dxa-listing.ts` and `dxa-run.ts` must reach host paths only through
`containerPath()` (never `hostPath()`), exactly as `host-tool-client.ts`'s own
header comment states for itself: *"never through `hostpath.ts`, which this
file must NEVER import"* `[VERIFIED: src/mcp/vice/host-tool-client.ts:29-38]`.

**How to avoid:** `dxa-run.ts` never imports `hostpath.ts`; it receives
already-translated container paths back from `runHostToolFromContainer()`,
the same way `ghidra.analyze` callers do today.

### Pitfall 7: `HOST_TOOL_FAMILY_FLOOR` must be raised in the same commit that adds the two new files

**What goes wrong:** `HOST_TOOL_FAMILY_FLOOR` is a **hand-pinned integer**
(currently `2 + 1 = 3`) that must equal the measured module count exactly
`[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:447,474-484 — "SEAM-06: the hand-pinned host-tool-family floor equals the measured count"]`.
Adding `dxa-listing.ts` and `dxa-run.ts` raises the real count to 5 without
this literal moving, which fails the equality test with the message *"the
module set moved underneath the plan that pinned this number."*

**How to avoid:** bump `HOST_TOOL_FAMILY_FLOOR` to `5` (or an explicitly
re-derived expression) in the same commit, per that test's own instruction —
"do NOT adjust the literal to fit... [without] naming the plan."

### Pitfall 8: dxa's `-a enabled`/`-a dump` line grammar — five shapes, reconciled

**What goes wrong:** the ROADMAP's Phase 35 notes say "the five measured line
shapes of `-a dump`," while `23-RESEARCH.md`'s Pitfall 4 prose says "the
default `-a enabled` listing has **four** line shapes." These are not the same
count of the same thing, and a plan that tries to match "five" against the
wrong source will not find it stated as a bare list anywhere. Reconciled by
reading `dxa-listing-parse.mjs`'s own regex behaviour against the two verified
transcript blocks: under `-a dump` specifically, exactly five line shapes
occur —

| # | Shape | Matches `DUMP_LINE_RE`? | Classification |
|---|---|---|---|
| 1 | Byte-emitting instruction line, tab before mnemonic (`0812 8d 20 d0 \tsta $d020`) | yes | code |
| 2 | Byte-emitting `.byt` data line, tab (`08bf 00 \t.byt $00`) | yes | data |
| 3 | Byte-emitting `.word` data line, **spaces** not tab (`08b7 92 08      .word l892`) | yes | data |
| 4 | Label-only line, blank byte column (`0810          l810:`) | **no** — correctly skipped | neither (emits no bytes) |
| 5 | Mid-instruction label line, blank byte column, `= * + n` suffix (`08a6          l8a6 = * + 1`) | **no** — correctly skipped | neither (emits no bytes) |

`[VERIFIED: src/mcp/vice/... actually .planning/phases/23-.../evidence/dxa-listing-parse.mjs:45 (`DUMP_LINE_RE`) cross-read against evidence/fixture/fixture-baseline.txt's full `-a dump` transcript (lines showing all five shapes verbatim) and 23-RESEARCH.md:962-994 (Pitfall 4's `-a enabled`-vs-`-a dump` discussion)]`.
**How to avoid:** port `DUMP_LINE_RE` unchanged; its correctness already
depends on shapes 4 and 5 **not** matching (they must fall through as
"unaccounted" only if a real release's data is genuinely lost, never by
design — the byte-total assertion is what converts a sixth, unseen shape into
a refusal rather than a silent undercount).

## Code Examples

### The listing parser, ported (the whole of `DXA-02`'s non-refusal path)

```javascript
// Source: .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/dxa-listing-parse.mjs
// (read in full this session; this is the ENTIRE line-matching surface —
// "exactly one line-matching regular expression" is asserted by the
// original plan's own acceptance criterion and should carry into DXA-02's
// production version)
const DUMP_LINE_RE = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$/;

export function parseDumpListing(text, imageSize) {
  const code = new Set(), data = new Set();
  let accounted = 0;
  for (const line of text.split("\n")) {
    const m = DUMP_LINE_RE.exec(line);
    if (m === null) continue;                       // shapes 4/5 above
    const address = parseInt(m[1], 16);
    const bytes = m[2].trim().split(/ +/);
    const isData = m[3].startsWith(".byt") || m[3].startsWith(".word");
    const target = isData ? data : code;
    for (let i = 0; i < bytes.length; i += 1) { target.add(address + i); accounted += 1; }
  }
  if (accounted !== imageSize) {
    // THE REFUSAL. Named, thrown, carries both counts. Never dxa's exit status.
    throw new Error(
      `dxa-listing-parse: accounted byte total ${accounted} does not equal ` +
      `expected image size ${imageSize}. Refusing to report an under-counted classification.`
    );
  }
  return { code, data, accounted };
}
```

`[VERIFIED: .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/dxa-listing-parse.mjs:42-119, this exact logic re-run this session's predecessor (Phase 23) against the rebuilt fixture and producing PARSE_ACCOUNTED_BYTES: 279 exactly matching the declared image size]`

### Provoking the refusal on a REAL unknown form (`DXA-02` criterion 2)

Phase 23 already demonstrated the refusal firing on a **hand-truncated**
listing (`[VERIFIED: fixture-baseline.txt, "## 4. The refusal, demonstrated"
— accounted 247 vs expected 279, matched 112 of 125 lines]`). `DXA-02`'s
amended text requires the refusal be provoked by **a real unknown listing
form from an actual run**, not only a planted truncation. The recommended
route: run `dxa -a dump` against the full `danish.d64` corpus release (once
depacked to a flat 64K image via Phase 33's capture pipeline,
`evidence/capture-pair.mjs`) rather than only the 279-byte synthetic fixture —
a real cracked release, at 65536 bytes with genuine illegal-opcode and
self-modifying-code content, is far more likely to surface a sixth line shape
dxa 0.1.5's own author never anticipated than a hand-written 279-byte fixture
is. This is a real run producing a real, unplanned refusal (or, if it does
not refuse, that absence is itself worth recording rather than assumed).

## State of the Art

| Old approach (v0.6.0 pivot) | Current approach (this phase) | When changed | Impact |
|---|---|---|---|
| dxa's exit status treated as pass/fail signal | This project's own parser refuses by name on a byte-total mismatch | Phase 23 MEASURED `-d strict` exits 0 on an inconsistent fixture | A caller can no longer mistake "dxa ran without crashing" for "the listing is trustworthy" |
| Published 141/138 ground truth taken on trust | Ground truth re-derived from the assembler's own report and found NOT reproducible (145/131, or 145/134 with pad) | Phase 23, `fixture-baseline.mjs` | `PROOF-01`/`DXA-04` cannot cite the pivot's numbers as ground truth; only the source-derived 72.39%/3-FP baseline is apples-to-apples |
| `-a enabled` listing (no byte columns, lengths inferred from mnemonics) | `-a dump` listing (byte columns present, lengths read not inferred) | Phase 23 Pitfall 4 | Removes the length-inference failure mode entirely; is what makes the byte-total refusal possible at all |

**Deprecated/outdated:** the `-a enabled` mode as a parsing target — still
useful for a human reading dxa's stderr/log output, never as the machine-
readable route this phase owns.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The vendored source should live at `src/mcp/vice/vendor/dxa/` rather than a repo-root `vendor/` directory | Architecture Patterns / Recommended Project Structure | Low — this is a naming/location choice with no behavioural consequence; the plan may relocate it, but every other guard citation above (files[], hostpath-consumers, ci-suite-coverage) needs updating to match wherever it actually lands |
| A2 | The build should be gated by an idempotent, hash-checked script in the `ensure-mcp-deps.sh` style, rather than building on every `dxa.disassemble` invocation | Standard Stack / Installation | Low-Medium — dxa's build is a few seconds of `gcc`, so a lazy build-per-call is also viable; the recommendation follows established project convention but is not forced by any measured constraint |
| A3 | A new `HostToolId` member should be spelled `"dxa.disassemble"` | Architecture Patterns / Pattern 1 | Low — the two anticipatory test-file names (`dxa-listing.ts`, `dxa-run.ts`) are fixed by Phase 34's committed test, but the wire-level tool-id string itself is not pinned anywhere and is the plan's free choice |
| A4 | `DXA-04`'s byte-derived tier should use `data` as its positive class (matching Phase 23's framing) rather than `code` | Ground-Truth Partition | Low — this is a reporting convention; Phase 38 consumes whichever convention this phase fixes, and either is internally consistent as long as it is stated |
| A5 | The GPL header text should be quoted from `main.c` (or all six `.c` files, noting variance) rather than from a project-wide `NOTICE`-style summary | Common Pitfalls, Pitfall 2 | Low — `DXA-01`'s text requires quoting from source headers; which specific file(s) to quote is a packaging choice, not a technical constraint |

## Open Questions

1. **Where exactly does the vendored `dxa` binary get cached once built, and by what mechanism does `dxa-run.ts` find it?**
   - What we know: `ghidra.analyze` uses an environment variable
     (`GHIDRA_HOME`) resolved host-side because Ghidra is a *declared host
     prerequisite*, never vendored. `acme.build` resolves `ACME_BIN` with a
     fallback to bare `acme` on `$PATH`. dxa is neither — it is vendored AND
     built by this project, so neither existing pattern transfers directly.
   - What's unclear: whether the built binary's path is a fixed, computed
     location under `vendor/dxa/dxa` (relative to the module, reached the same
     way `resources/host-tool.mjs` is reached on the host route) or an
     env-var override with that as a fallback.
   - Recommendation: fixed path under `vendor/dxa/dxa`, computed the same way
     `host-tool.mts` already resolves its own `resources/` path relative to
     `import.meta.url`, with the build gate refusing (not silently building)
     if the pinned digest doesn't match — this is a planner decision, not a
     research gap, but it is genuinely undecided by anything measured so far.

2. **Does `DXA-03`'s real-image exercise need `AUTO-06`-style VIC-pointer
   derivation to exist first, or can it use a hand-supplied data range?**
   - What we know: `AUTO-06` (VIC-pointer-derived graphics ranges) is Phase
     37's requirement, not this phase's. `DXA-03`'s text only requires the
     `-B`/`-l` route be "exercised on a real image," not that the ranges come
     from automatic VIC derivation.
   - What's unclear: whether a plan should hand-supply one or two known-data
     ranges on the danish corpus image (e.g. by reading the `.d64`'s directory
     structure or a manually-identified screen/charset region) to prove the
     route works end to end, deferring automatic derivation to Phase 37.
   - Recommendation: hand-supply a range for this phase's own exercise; do
     not block `DXA-03` on `AUTO-06` landing first. State this explicitly in
     the plan so Phase 37's `AUTO-07` (feeding VIC-derived ranges back to dxa)
     is understood as reusing this same emitter, not building a second one.

3. **Should the `.prg`/flat-64K distinction affect `dxa.disassemble`'s argument shape, or is it purely a caller-side choice of which image to hand in?**
   - What we know: `-g 0000` is required for a flat 64K capture (to defeat
     dxa's own load-address auto-detection) but is presumably wrong or
     unnecessary for a genuine `.prg` with a real load address the caller
     wants dxa to honour.
   - What's unclear: whether `dxa.disassemble`'s typed args should carry an
     explicit `imageKind: "prg" | "flat64k"` (or an explicit `loadAddress`
     override) so the `-g` flag is derived rather than left to the caller to
     get right by convention.
   - Recommendation: make the flag explicit in the typed args (mirroring how
     `ghidra.analyze`'s callers must already reason about `.prg`-vs-flat-64K
     routes per Phase 23's own `FlatVolatile.java` branching) — this avoids a
     silent Pitfall-1-class re-basing bug reaching production.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| `gcc` / `make` | Building vendored dxa from source | ✓ (used by Phase 23's own build) | unpinned, whatever `gcc -Wall -Wmissing-prototypes -O2` accepts | — |
| `curl` | Fetching the pinned tarball | ✓ (used by Phase 23) | unpinned | `wget` if unavailable, but not measured this session |
| `dxa` itself (pre-built, on `$PATH`) | — | **✗ — confirmed absent** | — | None needed: `DXA-01` requires vendoring and building it regardless, so "not on `$PATH`" is the expected, designed-for state, not a gap |
| `danish.d64` / `saeger.d64` (real corpus) | `DXA-03`/`DXA-04`'s real-image exercise | ✓ on disk, gitignored, never committed (`D-27`) | sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` (danish) | — |
| A flat 64K capture of `danish.d64` | Same | Not currently committed anywhere (Phase 33's own captures live in a `PROBE_DIR` cache, not the repo) | — | Re-run Phase 33's `evidence/capture-pair.mjs` `run` verb against the on-disk `danish.d64` to regenerate one; the pipeline is documented and reproducible, just not materialised on disk right now |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the flat-64K danish capture needs
regenerating via Phase 33's own documented pipeline before `DXA-03`/`DXA-04`'s
real-image exercise can run against it.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), no third-party framework |
| Config file | none — `src/mcp/vice/package.json:58`'s `test` script is `node --test '*.test.*'` |
| Quick run command | `cd src/mcp/vice && npm run test:automated` (skips `MANUAL_ONLY_TESTS`) |
| Full suite command | `cd src/mcp/vice && npm test` (includes manual-only files; per project memory this can hang — prefer `test:automated` for routine sampling) |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test type | Automated command | File exists? |
|---|---|---|---|---|
| DXA-01 | Fetch pin written before fetch; `sha256` re-verified; build reproduces pinned binary digest | integration (build-gated) | `node --test dxa-build-gate.test.ts` (new) | ❌ Wave 0 |
| DXA-01 | THIRD-PARTY-NOTICES.md quotes GPL header verbatim, no longer claims "no GPL material" | structural | `node --test third-party-notices.test.ts` (new, or extend existing notices test if one exists) | ❌ Wave 0 — confirm no existing notices test first |
| DXA-02 | Parser accounts for exactly 5 line shapes; refuses (throws, named) on byte-total mismatch | unit | `node --test dxa-listing.test.ts` (new) | ❌ Wave 0 |
| DXA-02 | Refusal provoked by a REAL unknown form from a real corpus run, not only a planted truncation | manual/live (needs vendored dxa binary + real image) | not automatable without a built dxa on the test machine | ❌ Wave 0 — `MANUAL_ONLY_TESTS` candidate |
| DXA-02 | Overlapping decode (`jsr` into mid-instruction target) yields `unclassified` with a reason, never a winner | unit | `node --test dxa-listing.test.ts` (synthetic overlapping-decode fixture) | ❌ Wave 0 |
| DXA-03 | `-B`/`-l` emitter reads the 12-member vocabulary correctly; excluded ranges absent from dxa's classification on a real image | integration (needs vendored dxa binary) | manual or gated live test | ❌ Wave 0 — `MANUAL_ONLY_TESTS` candidate |
| DXA-04 | Partition script's fixture-tier output matches the already-measured `FIXTURE_*` numbers exactly | unit | `node --test dxa-partition.test.ts` (new) | ❌ Wave 0 |
| DXA-04 | Partition script's byte-derived tier correctly classifies a synthetic BASIC-stub `.prg` and reports everything else `unknown` | unit | `node --test dxa-partition.test.ts` (new) | ❌ Wave 0 |
| SEAM-06 (carried) | `dxa-listing.ts`/`dxa-run.ts` never import `hostpath.ts`; `HOST_TOOL_FAMILY_FLOOR` raised to match | structural | `node --test hostpath-consumers.test.ts` (existing, already anticipates these two files) | ✅ exists, currently red-by-absence-of-files (named-absence test passes vacuously until the files exist, then must still pass) |

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && npm run test:automated`
- **Per wave merge:** full suite (`npm test`), or `test:automated` plus an
  explicit manual run of any new `MANUAL_ONLY_TESTS` entry if a real dxa
  binary is available on the machine
- **Phase gate:** full suite green (with the pre-existing, unrelated
  `anno-register.test.ts` failures noted in Phase 33's own baseline as an
  accepted, out-of-scope pre-existing condition) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/mcp/vice/dxa-listing.test.ts` — covers DXA-02 (5 line shapes, refusal, overlapping-decode `unclassified`)
- [ ] `src/mcp/vice/dxa-partition.test.ts` — covers DXA-04 (fixture-tier reproduction of the already-measured numbers, byte-derived-tier BASIC-stub classification, `unknown` for everything else)
- [ ] `src/mcp/vice/dxa-build-gate.test.ts` — covers DXA-01 (digest gate written before fetch, re-verified sha256, build-reproduces-pinned-digest — structured as a script the test invokes, not a live network fetch inside the test itself)
- [ ] A `MANUAL_ONLY_TESTS` entry (name TBD by the plan, e.g. `dxa-live.test.ts`) for anything that needs the actual vendored dxa binary built and a real corpus image — mirrors `fork-live.test.ts`'s and `stock-live.test.ts`'s existing pattern of default-SKIP-everywhere, opt-in via an env var
- [ ] Framework install: none — Node's built-in test runner already covers everything this phase needs

**This phase's hazard, stated plainly (per the validation-architecture
directive):** every claim in this phase's success criteria is either a
**rate** (data-recovery percentage, false-positive count) or a **refusal**
(the parser's thrown error, the `unclassified` disposition). Both are
trivially faked — a test can assert "the function threw" without the error
being provoked by anything real, and a rate can be computed against a
partition that was quietly hand-tuned to flatter it (exactly what happened to
the pivot's own 141/138 figures). Every test above is written to defend
against that specific failure mode:

- **The build's honesty test is a DIGEST, not a "did it exit 0" check** — a
  build gate that only checks exit status would pass on a build that silently
  linked against a different libc or compiler flags and produced a
  functionally-different binary; the `sha256`-equals-pin check is what
  actually proves reproducibility.
- **The refusal test's honesty depends on using a REAL unknown line shape**,
  not a shape invented for the test. The unit test (`dxa-listing.test.ts`)
  necessarily uses synthetic input, so it alone cannot satisfy `DXA-02`'s
  criterion 2 — the `MANUAL_ONLY_TESTS` live run against a real corpus image
  is not optional decoration, it is the one piece of evidence a unit test
  structurally cannot provide.
- **The partition test's honesty depends on matching Phase 23's ALREADY
  independently re-derived numbers**, not on the partition script's own
  output checked against itself. `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`
  et al. are the target; a script that reproduces a different number is wrong
  by definition, since those numbers were reproduced once already from first
  principles.
- **The `-b` exclusion test's honesty depends on checking dxa's ACTUAL
  classification output, not merely that the emitter produced a
  syntactically valid `-B` file** — the criterion is "excluded from
  discovery," which can only be observed post-hoc in dxa's own listing.

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V1 Architecture | yes | The host-tool execution seam's own typed allowlist (SEAM-01/02) — this phase adds a member to an existing closed set, it does not open a new trust boundary |
| V5 Input Validation | yes | `normaliseHostToolRequest()`'s narrowing (never coerces, never drops a key) extends unchanged to the new `dxa.disassemble` member; all path arguments go through the existing `resolveWorkspacePath()` |
| V10 Malicious/Untrusted Code (supply chain) | yes | dxa's own self-declared "alpha" status, no upstream signature, dormant since 2022 — mitigated by the `sha256` pin (checked before fetch and re-verified against the build), never by trust in the source |
| V12 File and Resources | yes | Build artifacts (the compiled `dxa` binary) live in a fixed, workspace-confined location; the parser's own `-a dump` listing output is read only via `containerPath()`-translated paths, never a raw host path crossing the boundary |
| V2/V3 Authentication/Session | no | No auth surface — this is a local, single-operator toolchain |
| V6 Cryptography | partial | `sha256` digesting only (no encryption); already-established project pattern (`digestOutputFile()` in `host-tool.mts`), not a new primitive |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Tampered tarball (compromised download, MITM) | Tampering | `sha256` pin written **before** the fetch (Phase 23's convention, reused), HTTPS-only fetch, re-verification of the built binary's digest against the same pin |
| Argv injection via caller-supplied path arguments | Tampering / Elevation of Privilege | Already mitigated structurally by `host-tool.mts`'s typed allowlist — no raw argv passthrough anywhere, every path resolved through `resolveWorkspacePath()` before ever reaching argv (the SAME mechanism `acme.build`/`ghidra.analyze` already use — this phase's new member inherits it by construction, not by a new check) |
| Command substitution via a malicious build script name | Tampering | The `EXPECTED_TRACKED_SHELL_SCRIPTS` gate (Pitfall 3) forces any new shell script to be a deliberate, reviewed addition, never a silent drop-in |
| A vendored C source carrying a supply-chain backdoor | Tampering / Information Disclosure | Out of scope to fully mitigate (this project cannot audit 3,417 lines of third-party C for backdoors as part of this phase), but the `sha256` pin at least guarantees the *exact* bytes reviewed once (Phase 23's build+run) are the bytes shipped every time thereafter — no silent upstream re-fetch |
| Denial of service via a pathological input image causing dxa to hang or consume unbounded memory | Denial of Service | `HOST_TOOL_TIMEOUT_MS`'s existing per-tool ceiling mechanism (`[VERIFIED: src/mcp/vice/host-tool.mts:766, "ghidra.analyze": 600_000]` as the existing pattern) extends to a `dxa.disassemble` entry; dxa's own small, single-pass design (no recursive descent into unbounded structures observed in Phase 23's runs) makes this a low-likelihood but cheap-to-mitigate risk |

## Sources

### Primary (HIGH confidence — read directly this session)

- `src/mcp/vice/anno-types.ts:195-249` — the frozen 12-member `DATA_TYPES` vocabulary
- `src/mcp/vice/host-tool.mts` (multiple ranges: 96-181, 590-700, 726-830) — the `HostToolId` union, allowlist shapes, `buildHostToolArgv()`, `HostToolFileResult`, timeout table
- `src/mcp/vice/host-tool-client.ts:1-50` — container/host route split, the `hostpath.ts` import ban
- `src/mcp/vice/hostpath-consumers.test.ts:403-529` — SEAM-06's second floor, the named-absence assertions for `dxa-listing.ts`/`dxa-run.ts`
- `src/mcp/vice/ci-suite-coverage.test.ts:1-238` — the repo-wide test-directory walk and its coverage registry
- `src/mcp/vice/host-scripts.test.ts:202-224` — `EXPECTED_TRACKED_SHELL_SCRIPTS`
- `scripts/check-npm-packages.mjs:93-102` — the leak-check patterns
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` (opening paragraph) — the false-after-vendoring claim
- `/home/henrik/.cache/c64-re-tools/phase23/dxa-0.1.5/{main,dump,scan,label,table,vector}.c` (headers 1-25 each) — the verbatim GPL notice text, read directly from the sha256-verified, extracted tarball
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/dxa-listing-parse.mjs` (full file) — the production-candidate parser
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture-baseline.{mjs,txt}` (full files) — the source-derived ground truth and its cross-check against dxa's output
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/instrument-provenance.txt` (full file) — the fetch/build/verify transcript
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/SCHEMA.md:190-289` — criterion-1 measurement definitions, window derivation, the fixed dxa flag set
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md` (Pitfalls 1-5, Code Examples) — dxa-specific gotchas, all MEASURED
- `.planning/REQUIREMENTS.md` (DXA-01..04, decision 2, traceability table) — the current, amended requirement text
- `.planning/ROADMAP.md` (Phase 35 section, Standing Constraints) — success criteria, dependencies, guard warnings
- `docs/phase33-reproducible-run-gate-findings.md` (§ input 4, `C0_CAPTURE_PAIR`) — the real-image exercise's availability
- `.planning/STATE.md` (Phase 27/28/34 decision log entries) — the 12-member vocabulary's freeze decision, SEAM-05's `dxa` ban, SEAM-06's floor rationale

### Secondary (MEDIUM confidence)

- FreeBSD ports `devel/dxa65` `distinfo` — cross-checked by Phase 23, not re-fetched this session, cited via Phase 23's own citation

### Tertiary (LOW confidence)

- None — the research-scope directive explicitly excluded web research for this phase ("Skip `--research-phase`... This is implementation")

## Metadata

**Confidence breakdown:**
- Standard stack (dxa version, pin, build): HIGH — reproduced end-to-end by Phase 23, re-confirmed by direct file reads this session
- Architecture (host-tool seam integration): HIGH — the exact allowlist shape, arg-key patterns and anticipatory test names were read directly from committed source
- Ground-truth partition design (`DXA-04`): MEDIUM — the byte-derivable facts (BASIC stub, `.prg` header) are verifiable claims about the C64 platform, but the specific design (two-tier partition, `data` as positive class) is this research's proposal, not a measured fact, and is flagged accordingly in the Assumptions Log
- Pitfalls: HIGH — every pitfall cites a specific guard file and line range read this session, or a specific Phase 23 transcript line

**Research date:** 2026-09-04
**Valid until:** 30 days (stable — dxa is dormant upstream, and the host-tool
seam it must integrate with is this project's own code, unlikely to drift
faster than the milestone itself)
