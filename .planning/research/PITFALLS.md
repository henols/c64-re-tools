# Pitfalls Research

**Domain:** Adding an owned annotation store to a mature MCP-server codebase, and deleting
a deeply-integrated static-analysis dependency from it (v0.7.0 "Own the Annotation Store")
**Researched:** 2026-08-26
**Confidence:** HIGH for everything measured directly against this repository's working tree
this session — file inventories, line counts, guard scopes, grep-gate blast radius, tool
schemas, `files[]` contents, CI gate wiring, test-file cross-references. Every number below
was produced by a command, not recalled. MEDIUM for the store-internals pitfalls
(interval/typing/undo), which are derived from upstream's own 12-type vocabulary and this
project's recorded incidents rather than observed against a store that does not exist yet —
stated at that ceiling per `ENGINEERING_RULES.md` §8.

**Evidence ceiling, stated plainly.** This is source-and-artifact inspection of a live tree.
Per the project's own hierarchy that proves *code shape*, not runtime behaviour. Where a
pitfall's prevention is "run the real external oracle", that is because inspection cannot
settle it — and this project has been taught six times that the internal check does not
substitute.

This document assumes `.planning/PROJECT.md` (Current Milestone: v0.7.0), `CLAUDE.md`,
`.planning/ENGINEERING_RULES.md` and `.planning/notes/auto-annotation-from-ghidra-xrefs.md`
are open. It does not restate them. It extends the five hazards named in the milestone brief
rather than rediscovering them.

---

## Measured corrections to the brief (read this first)

The brief's framing is right; six of its figures are not, and a roadmapper sizing phases off
them will size them wrong.

| Brief says | Measured this session | Why it matters |
|---|---|---|
| "Three `ATTRIBUTION (ABS-02)` headers in `src/skills/*/SKILL.md`" | **Five header blocks across three files** — 2 in `c64-program-recon/SKILL.md`, 2 in `c64-memory-mapping/SKILL.md`, 1 in `routine-queue-walker/SKILL.md`. Plus **five more** in the gitignored generated tree `installer/skills/` | The grep-gate exemption set is 10 instances in 2 trees, not 3 in 1. An exemption list of 3 leaves 7 firings that look like real reintroductions |
| "53, 54 and 21 mentions" of `anno_*` in three skills | **36 / 27 / 14 tool-name mentions** = 82 total, spread over **5 files** not 3 (`c64-program-recon/SKILL.md`, `.../scripts/packer-finding.mjs`, `.../templates/memory-map.template.md`, `c64-memory-mapping/SKILL.md`, `routine-queue-walker/SKILL.md`), plus **13** `vice-mcp anno <verb>` CLI-verb mentions. 17 distinct tool names + `anno_batch_execute` | One of the five is an **executable `.mjs` script**, not prose. Re-pointing playbooks leaves a runtime hole. And `templates/memory-map.template.md` is a template an agent *copies*, so a stale route propagates into every future project |
| "Three committed guards are pinned to the subject being deleted" | **13 non-`anno-`named test files reference anno**: `docs-anno-decisions` (8), `hostpath-consumers` (22), `skill-attribution` (20), `stock-dispatch` (21), `vice-proxy` (29, **manual-only**), `docs-dangling-refs` (18), `hop-chain-comments` (8), `capability-registry` (5), `tool-support-table.test.mjs` (5), `disasm-roundtrip` (3), `skill-acme-build-cli` (2), `stock-connect` (1), `audit-integrity` (1) | "Every guard pinned to the deleted subject is given an explicit fate" is a 13-item list plus the 21 `anno-*.test.ts` files, not a 3-item one |
| "a whole-tree grep gate" (the `toacme` precedent) | The precedent gate, `scripts/check-skill-fork-honesty.mjs`, walks **`src/skills/`, `README.md`, `docs/stock-vice-parity.md` and `src/mcp/vice/`** — its own comment concedes "this script's own skills walk only covers src/skills/ and README.md". It is **not** whole-tree | Copying the precedent verbatim produces a gate blind to `docs/`, `installer/`, `scripts/`, `.claude-plugin/` and the published tarballs |
| the removal is `~25,700` lines | **Exactly right**: 10,102 non-test + 15,657 test across `anno-*.ts` = 25,759. Plus `fixtures/coverage/` (12 fixture dirs, 212 KB, its own generator `make-coverage-fixtures.mjs`), 19 entries in `package.json` `files[]`, ~120 lines of `vice-proxy.ts` wiring, and 3 `scripts/` consumers | The code number is honest; the *satellite* surface is what gets missed |
| "the existing `--verify` seam" is reusable for ACME verification | `anno-verify.ts` parses **the external analyser's `--verify` output** and calls `buildVerifyArgs`/`runAnno` from `anno-launch.ts`. The **parser** survives the deletion; its **producer does not** | STORE-06 as worded cannot be satisfied by reuse. See Pitfall 9 — this is the single most dangerous item in the milestone |

Additional measured facts a roadmapper needs:

- `git grep -l the external analyser` = **291 tracked files**; excluding `.planning/` = **55**. So
  ~236 tracked files legitimately keep the word forever (roadmaps, requirements, milestone
  records, phase artifacts, decision rows). A gate scoped "whole tree" fires 236 times.
- `installer/skills/` is **`.gitignore`d generated output** (`/installer/skills/`, line 43)
  rebuilt by `installer/scripts/sync-skills.mjs`, and it currently contains **11 files**
  mentioning the external analyser in this working tree. A filesystem grep sees them; a `git grep`
  never does; the **published `@henols/c64-re-tools` tarball ships them**.
- `capability-registry.ts` contains **zero** anno entries and `tools-manifest.json` /
  `tools-manifest.stock.json` contain **zero** anno mentions. The `anno_*` family was never
  in the manifest or the registry. STORE-03's "declared in `capability-registry.ts`" is
  therefore a **new** obligation with new consumers, not a carry-over.
- `disasm-roundtrip.test.ts` — this project's real-ACME oracle — imports `ACME_BIN`,
  `acmeSkipReasonFor` and `assertAcmeRequiredIfEnvSet` **from `anno-test-gate.ts`**, and CI
  installs ACME and sets `VICE_REQUIRE_ACME=1` against exactly that seam.
- `anno-project.ts:339` already implements write-to-`.tmp-$pid-$now`-then-`renameSync`, the
  idiom shared with `refresh-manifest.ts`, `install-resources.ts`, `incident-record.ts` and
  `vice-broker.mts`. **None of the five `fsync`s.**

---

## Critical Pitfalls

### Pitfall 1: The seven-type vocabulary is narrower than the store it replaces, and the loss is silent

**What goes wrong:**
The milestone text names seven types — code, byte, word, address, PETSCII, screencode,
**table**. The store being deleted offers **twelve**, and the four it offers that "table"
collapses are the load-bearing ones: `lo_hi_address`, `hi_lo_address`, `lo_hi_word`,
`hi_lo_word` (plus `external_file` and `undefined`). Implement seven literally and a split
pointer table becomes an opaque "table": the byte order is unrecorded, so the exporter must
guess, and a wrong guess produces a *plausible* pointer set — labels at addresses that exist,
cross-references that resolve, comments that read correctly — pointing at the wrong targets.

**Why it happens:**
Seven reads like a complete vocabulary. It is also exactly the trap that killed `cc65` for
this project: the v0.5.0 close records `da65` rejected because "`RANGE TYPE` vocabulary cannot
express a split-address table or a struct, so everything Ghidra recovers dies at that export
boundary." A seven-type store re-creates that boundary **inside this project**, one milestone
after rejecting a tool for having it.

**How to avoid:**
Take upstream's vocabulary as the floor, not the ceiling, and record the diff explicitly.
Minimum additions over the seven: split-table orientation (lo-hi vs hi-lo) and element kind
(address vs word) as **first-class type variants, not a flag on "table"**; `external_file` for
blobs exported as-is; `undefined` as an explicit reset state distinct from "never typed". Carry
forward `anno-coverage.ts`'s **dispatch-context gate** distinction — a split lo/hi pairing is
`PROVEN` or `ADVISORY`, never silently promoted — which is 2,292 lines of already-earned
knowledge sitting on the delete side of the line.

**Warning signs:**
- A `DataType` union with a bare `"table"` member.
- An exporter that emits `!word` for a split table (structurally impossible — the low bytes
  and high bytes are not adjacent).
- A type-setting tool that accepts an odd-length range for a table type. Upstream requires
  "even count" for all four split variants; the absence of that validation is the tell.

**This symptom is a confident wrong answer, not an error.** A mis-oriented split table
reassembles byte-identically (the bytes never changed), so the ACME gate passes. Everything
downstream — labels, xrefs, the memmap join, DECOMP-03/04 — is wrong.

**Observing the control RED:** a fixture with a known `lo_hi_address` table, typed as
`hi_lo_address`, must produce a **differing resolved-target set** and the test must fail. If
your test only asserts "reassembles clean", it cannot go red here and is not the control.

**Phase to address:** Phase 27 (Store core — the type model is the schema decision, and it is
irreversible once data exists).

---

### Pitfall 2: Inclusive range ends, and the off-by-one that repairs itself into a wrong answer

**What goes wrong:**
Upstream's schema is explicit: `start_address` "(inclusive)", `end_address` "(inclusive)" — for
both `set_data_type` and `add_scope`. Any layer that treats the end as exclusive is off by one
byte. For a `byte` range that is cosmetic. For a `word`, `address` or split-table range it
**re-pairs every element**: drop one byte from a 4-entry `lo_hi_address` table and you get a
3.5-entry table, which either throws (best case) or silently re-pairs into four *different*
addresses that all look legitimate.

**Why it happens:**
Two conventions coexist in the surrounding code — half-open intervals are the JavaScript
default (`slice`, `subarray`), and the store's wire contract is closed. The conversion happens
at every boundary: tool schema → internal model → decoder → renderer → exporter → coverage
census. Six chances to be inconsistent, and five of them produce plausible output.

**How to avoid:**
One named type with one documented convention, asserted at the boundary:
`interface AddrRange { start: number; endInclusive: number }` — the field name *is* the
documentation, per this project's naming conventions. Never a bare `end`. Add a
length-invariant assertion at the seam: `endInclusive - start + 1 === byteLength`, and for
split types `byteLength % 2 === 0` with the pairing rule named in the error message.

**Warning signs:**
`end`, `stop`, `last`, `limit` used interchangeably in the same module. A test whose fixture
range length is even *and* whose element count is even (masks the error). A range covering
`$FFFF` — the classic wrap: `endInclusive = 0x10000` is out of the 16-bit space and
`start + length` overflows a `uint16`.

**Observing the control RED:** a range `$0400-$0400` (one byte) must report length 1. Change
the model to exclusive and that test must fail. A boundary test at `$FFFF` must reject or
handle explicitly, never wrap to `$0000`.

**Phase to address:** Phase 27 (Store core).

---

### Pitfall 3: A partially overwritten typed range — shrink, drop, or split

**What goes wrong:**
The store types `$1000-$10FF` as `byte`. A later call types `$1040-$104F` as `code`. Three
implementations are natural and two are wrong:
- **drop** the old range → `$1000-$103F` and `$1050-$10FF` lose their typing and silently
  revert to undefined, so the exporter emits them as raw bytes with no comment and the coverage
  census counts them as unclassified. The annotator's earlier work vanishes with no message.
- **shrink** to the surviving prefix → `$1050-$10FF` is silently untyped (worse: it is
  *invisibly* untyped, since the range object still exists and reads as valid).
- **split** into `$1000-$103F` byte + `$1040-$104F` code + `$1050-$10FF` byte → correct.

**Why it happens:**
Range storage is usually a flat array with a linear scan; "remove overlapping, insert new" is
three lines and passes every test written against non-overlapping fixtures. Splitting requires
deciding the semantics first.

**How to avoid:**
Make the store's overwrite semantics an explicit, documented decision (split-and-preserve),
implemented in **one** seam — the project's single-seam convention — and pin it with a
three-way test: fully-contained overwrite (splits into 3), left-overlap (2), right-overlap (2),
exact match (1, replaced), and superset (1, replaces). Five cases, and each one must assert
the *total byte coverage is unchanged*, which is the invariant that catches all five at once.

**Warning signs:**
A range table with no split operation anywhere. A `setDataType` that calls `filter()` on the
range list. Total-typed-byte count that goes **down** after an overwrite that should leave it
flat.

**This symptom is silent.** No error is raised; a previously-documented region simply stops
being documented, and the next session re-derives it (which is the exact failure the store
exists to prevent — see `CORE-01`'s reversal condition (a)).

**Observing the control RED:** the coverage/byte-accounting assertion is the red-maker. With
split-on-overwrite removed, "total typed bytes before == total after" must fail for the
fully-contained case.

**Phase to address:** Phase 27 (Store core).

---

### Pitfall 4: Address vs offset vs `.prg` load-address header, and decimal vs hex

**What goes wrong:**
Three coordinate systems are in play and only one is the store's: **memory address**
(`$0801…`), **image offset** (byte 0 of the loaded image), and **file offset** (byte 0 of a
`.prg`, which is the two-byte little-endian load address, so file offset = image offset + 2).
Mix any two and every annotation lands two bytes — or `$0801` bytes — from where it belongs.
Separately: upstream's tool schemas take **decimal integers** ("4096 for $1000") while every
skill playbook, every comment convention and every human writes `$1000`. A store that accepts
`"1000"` as a string cannot tell 4096 from 0x1000.

**Why it happens:**
The `.prg` header is invisible once loaded, so a fixture built from a flat 64K capture (no
header) and a fixture built from a `.prg` (header) disagree by two bytes and both "work" —
until the other one is used. And this project already has an adjacent recorded landmine:
VICE's monitor treats bare integer literals as **hex** (`RL == 100` means line 256), so the
codebase contains two opposite defaults for an unprefixed number.

**How to avoid:**
Store addresses as `number` in a single named domain with the domain in the type or the field
name (`address` = machine address, always; never a bare `offset`). Do the header stripping in
exactly one place, at ingest, and record the load address in the store's header so the mapping
is recoverable. For the MCP surface: accept `integer` (decimal, matching upstream's shape for
argument-compat) **and** a `$`-prefixed or `0x`-prefixed string, and **reject an unprefixed
numeric string outright** rather than guessing a base.

**Warning signs:**
A test fixture whose expected addresses are all 2 higher or lower than the assertion. An
ingest path with `slice(2)` and a sibling path without it. `parseInt(s)` with no radix.

**Observing the control RED:** a `.prg` fixture and a flat-64K fixture of the *same program*
must produce **identical** annotations. Reintroduce the two-byte skew and that equality test
fails.

**Phase to address:** Phase 27 (Store core), with the ingest seam pinned before Phase 28's
tool surface encodes an argument shape that is then compatibility-frozen.

---

### Pitfall 5: The store is flat-addressed and the machine is not

**What goes wrong:**
An annotation store keyed by 16-bit address asserts that an address means one thing. On a C64
it does not: `$D020` under `$01 = $34` is RAM, under `$35` it is the border colour; `$D000`
under `$33` is Character ROM, under `$35` it is sprite-0-X. The memmap join already resolves
bank state *before* the address (rule 3 of the auto-annotation note) and declines where bank
state is path-dependent. A flat store cannot record the distinction: one label, one comment,
one type per address. So the *store* becomes the place the banking knowledge is lost, after
the join went to the trouble of computing it.

**Why it happens:**
Flat addressing is correct for 95% of a program and the failure is concentrated in exactly the
code that matters most (loaders, IRQ handlers, anything touching ROM). And the milestone is
corpus-independent by design (`PROOF-03` is held with Phase 24), so no banking fixture is in
scope — meaning nothing will exercise it during v0.7.0 unless it is deliberately built.

**How to avoid:**
Do not build bank-aware storage this milestone — that is scope creep against a held phase. Do
**reserve the dimension** in the schema and make the omission loud rather than silent: an
optional `bank` qualifier field on labels/comments/types with a documented `null` = "bank-
agnostic / unqualified", and a schema version that permits adding it. Then, in the store's own
documentation and in the tool description, state that an unqualified annotation on `$D000-$DFFF`
or `$A000-$FFFF` is asserted **only** for the bank state the annotator observed. `AUTO-05`'s
decline-rather-than-guess rule is the correct future consumer of that field.

**Warning signs:**
A schema with no version field. A comment on `$D020` with no bank note. An enum applied to an
I/O address in a program that writes `$01`.

**This symptom is a confident wrong answer** — the same class as the memmap join's rule-3
failure, one layer down.

**Phase to address:** Phase 27 (Store core) for the reserved field and the schema version;
the resolution itself stays with held Phase 26 (`AUTO-04`/`AUTO-05`).

---

### Pitfall 6: Label collisions, non-nested scopes, and identifiers that are almost legal

**What goes wrong:**
Three distinct failures wearing one coat:
1. **Sanitising an illegal label.** Upstream is explicit and correct: a name must be a legal
   ACME identifier and "an illegal name is REJECTED, never sanitized or quoted." Sanitise
   instead (`init screen` → `init_screen`) and two different user labels silently collapse
   into one, so one routine's name now points at another's address.
2. **Mnemonic collision.** `LDA`, `INC`, `ROL` as label names assemble as instructions. Legal
   identifiers, illegal labels. `anno-acme-ident.ts` already implements this rejection — and
   it is **not** in CUT-02's reuse list.
3. **Scope leakage.** Upstream's scopes are ranges and "nested scopes are not supported". A
   scope-local name equal to a global name reassembles to *whichever one ACME resolves*, which
   is a function of emission order, not of the store's intent.

**Why it happens:**
Rejecting a name is user-hostile in the moment and sanitising feels helpful. And a collision
test needs two labels; single-label tests never see it.

**How to avoid:**
Keep `assertLegalAcmeIdentifier()` — **re-home it, do not delete it** (see Pitfall 12) — and
extend it with a uniqueness check against the store's live symbol set *scoped by the enclosing
scope range*, rejecting a duplicate rather than de-duplicating with a suffix. Auto-generated
names (upstream's `a_D011` shape) must live in a separate namespace from user names so a user
label can never be silently shadowed by, or shadow, a generated one.

**Warning signs:**
Any `replace(/[^A-Za-z0-9_]/g, "_")` near label handling. A `Map<address, name>` with no
inverse `Map<name, address>` (no inverse ⇒ no collision detection possible). A label list that
can contain the same string twice.

**Observing the control RED:** set two different addresses to the same label name; the second
call must be refused. Then export and reassemble under real ACME — with the rejection removed,
ACME itself must report a duplicate-symbol error, which is the external oracle confirming the
internal one.

**Phase to address:** Phase 27 (Store core) for the rejection and namespacing; Phase 29 (ACME
export) for the ACME-side confirmation.

---

### Pitfall 7: Comments and confidence prefixes orphaned when a range is retyped

**What goes wrong:**
A comment is anchored to an address. Retype the range containing it from `code` to `byte` and
the address is no longer an instruction boundary — it is byte 7 of a 16-byte table. Three
outcomes, all bad: the comment renders inside a `!byte` run (syntactically fine, semantically
nonsense); the comment is dropped by a renderer that only emits comments at instruction
boundaries (silent loss of an annotator's finding); or the comment survives but its
`[confirmed-code]` prefix now labels data as code, which is a **stated confidence about a
falsified claim**.

**Why it happens:**
Comments and types are stored in separate tables with no referential integrity between them,
which is the right storage decision and the wrong *update* decision. And the five-grade
confidence vocabulary is enforced today by `anno-confidence.ts` — the ONE authoritative place
for the `[confirmed-code]`/`[probable-code]`/`[confirmed-data]`/`[probable-data]`/`[unknown]`
convention — which is **not** in CUT-02's reuse list while `c64-program-recon/SKILL.md` and
`templates/memory-map.template.md` still instruct agents to write those exact tokens.

**How to avoid:**
On retype, do not delete or silently re-anchor. **Flag**: every comment whose anchor is no
longer a boundary of the new typing, and every comment whose confidence token contradicts the
new type (`[confirmed-code]` inside a `byte` range), is returned in the retype call's result as
an explicit list the caller must resolve. That turns a silent loss into a reported one, which
is the only difference that matters. Keep the five-grade vocabulary as the store's own
validated enum — one spelling, per its existing header's own prohibition on a second.

**Warning signs:**
A retype that returns `void` or a bare success. A renderer with no "orphaned comment" path. A
confidence token accepted as free text.

**Observing the control RED:** comment `$1047` `[confirmed-code] loop head`, then type
`$1040-$104F` as `byte`. The call must report one contradicted comment. Remove the check and
the call returns clean success — that is the red.

**Phase to address:** Phase 27 (Store core); the vocabulary's survival is a Phase 31 (Removal)
dependency.

---

### Pitfall 8: The enum applied to the wrong operand

**What goes wrong:**
`ANNO-13`'s validated behaviour is that `lda #$1b` / `sta $d011` renders as
`lda #D011_YSCROLL3_ROW25_SCREENON_TEXT`. Note where the enum goes: on the **immediate operand
of the `lda`**, named for the register the *later* `sta` targets. Two ways to get this wrong,
both silent:
1. **Apply it to the address operand** — `sta D011_YSCROLL3_…` — which either fails to
   assemble (loud, fine) or, if the enum value happens to be a legal address, assembles into a
   store to the wrong address (silent, catastrophic).
2. **Attribute the immediate to the wrong register.** The `lda #$1b` may be followed by two
   stores, or the value may reach `$d011` via `tax`/`pha`, or an unrelated `lda #$1b` earlier
   in the routine gets the enum from a later `sta`. The rendered name is then a confident
   semantic claim about a value that never reaches that register.

Compounding: which register `$d011` *is* depends on bank state (Pitfall 5). Under `$01 = $34`
that store goes to RAM and the VIC-II enum name is simply false.

**Why it happens:**
The join is address-keyed and the enum is value-keyed, so the linking step is a data-flow
inference — and a one-instruction lookback (`the immediately preceding lda`) works on every
hand-written fixture.

**How to avoid:**
Make the immediate→register attribution an **explicit, caller-supplied pair** at the tool
boundary (upstream's `apply_enum_usage` shape), never an inference the store performs. If a
future phase infers it, the inference lives in the engine layer (Ghidra's decompiler already
recovers this) and arrives as a fact, not a heuristic. Reject application to any operand that
is not an immediate.

**Observing the control RED:** the acceptance test that already exists in spirit —
`lda #$1b`/`sta $d011` renders with the enum name **and reassembles byte-identical under real
ACME**. Byte-identity is what catches the wrong-operand case: applying the enum to the address
operand changes the emitted bytes. Remove the immediate-only restriction and that
reassembly-identity test must go red.

**Phase to address:** Phase 29 (ACME export and the reassembly gate).

---

### Pitfall 9: "Reuse the `--verify` seam" is not possible as written, and the natural repair reopens D-10

**What goes wrong:**
This is the most dangerous item in the milestone, because the requirement text
(`STORE-06`, and the milestone's own "verified by a real ACME through the `--verify` seam")
describes a reuse that the deletion makes impossible. `anno-verify.ts` does **not** invoke
ACME. It invokes **the external analyser** (`buildVerifyArgs`/`runAnno` from `anno-launch.ts`) and
parses the external analyser's per-assembler result lines. Delete `anno-launch.ts` and the parser
has no producer.

The natural repair — call ACME directly and check the exit code — walks straight back into the
incident `anno-verify.ts` exists to prevent, recorded verbatim in its header: with ACME absent
from `PATH` and `ca65` present, a real run printed
`✗ ACME — ACME not found in PATH (skipped)` / `✓ All roundtrip verifications passed.` /
`EXIT=0`. Exit zero. An aggregate line reading as a full pass. The one assembler this project
cares about never ran. A `spawnSync("acme", …).status === 0` check on a *direct* ACME
invocation has the same shape of hole one level over: ACME missing → `spawnSync` sets `error`
and `status: null`, and a truthiness check on `status` reads a missing binary as a pass.

**Why it happens:**
The requirement says "reuse the seam", the seam exists, and its filename does not advertise
that it is an anno output parser. Nobody re-reads a module they were told to reuse.

**How to avoid:**
Split the seam explicitly in the plan, before the removal:
- **Keep** the verdict discipline — never derive `ok` from exit status, require unanimity
  across ACME result lines, refuse to guess when more than one authoritative line is present.
  Its false-pass transcript fixtures are pinned in `anno-verify.test.ts` and must move with
  it.
- **Replace** the producer with a direct ACME invocation modelled on
  `src/skills/acme-build/scripts/acme.mjs` (`spawnSync("acme", args, …)` — this repo's one
  existing direct-ACME call site), and make "ACME did not run" a **third outcome** distinct
  from pass and fail, exactly as `AssemblerOutcome = "ok" | "skipped" | "failed"` already
  models it.
- The byte-diff, not ACME's exit code, is the verdict for "reassembles identically".

**Observing the control RED — two separate reds, both mandatory:**
1. With `ACME_BIN` pointed at a non-existent path, the store's export verification must report
   **skipped/failed, never pass**. Restore the exit-code shortcut and this test must fail.
2. Feed the exporter a deliberately corrupted byte (one operand changed) — the byte-diff must
   fail while ACME itself still exits 0. This is the direction the v0.3.0 evidence proved in
   both senses ("an exit-1 run where ACME still passed, an exit-0 run where ACME never ran")
   and both directions must be re-proved against the new producer.

**Phase to address:** Phase 29 (ACME export), and it must land **before** Phase 31 deletes
`anno-launch.ts`. If the removal precedes the exporter, there is a window with no working
external oracle and every claim made in it is at fixture level.

---

### Pitfall 10: Deleting `anno-test-gate.ts` turns this project's strongest oracle into a silent skip

**What goes wrong:**
`anno-test-gate.ts` (166 lines, name says anno, sits squarely in the delete set) holds
**two** gates, not one. The external analyser half is genuinely dead after the removal. The
**ACME half is not**: `ACME_BIN`, `probeAcme()`, `ACME_AVAILABLE`, `acmeSkipReasonFor()` and
`assertAcmeRequiredIfEnvSet()`. Nine test files import from it; the one that survives the
milestone is `disasm-roundtrip.test.ts`, this project's real-ACME round-trip oracle. And CI
binds to it by name: `.github/workflows/ci.yml` installs the Debian `acme` package, greps its
own banner to prove the binary really is ACME, and sets `VICE_REQUIRE_ACME: "1"` so a missing
ACME is a hard **FAIL** rather than a named SKIP.

Delete the file as glue and the `VICE_REQUIRE_ACME` contract has nothing to bind to. The
store's ACME-verified export claim degrades from "hard fail if ACME is missing" to "silently
skip", in CI, with a green run.

**Why it happens:**
The filename. It is 166 lines of test infrastructure with an `anno-` prefix, and the deletion
sweep is prefix-driven.

**How to avoid:**
Re-home the ACME half under a non-anno name (`acme-test-gate.ts`) **in the same commit or
earlier** as the deletion, keeping the env var names byte-identical (`ACME_BIN`,
`VICE_REQUIRE_ACME`) because CI already sets them and a rename there is a second, silent
failure mode. Update the `ci.yml` comment that names `disasm-roundtrip.test.ts` if the binding
changes.

**Warning signs:**
A CI run where the ACME-dependent test count drops. Any `spawnSync("acme")` appearing in a
second module (the gate was created precisely because "six-plus hand-copied `probeAnno()`
bodies is exactly how a gate silently diverges").

**Observing the control RED:** with `VICE_REQUIRE_ACME=1` set and `ACME_BIN` pointed at a
nonexistent path, the suite must **FAIL**. If it skips, the gate is gone. This is the single
cheapest red to run and it should be run at every phase boundary in this milestone.

**Phase to address:** Phase 29 (ACME export) at the latest; ideally Phase 27, since new store
tests will want it.

---

### Pitfall 11: "Save succeeded" proved by a hash delta, which proves neither the mutation nor durability

**What goes wrong:**
The existing precedent, `saveAndVerify()` in `anno-mcp-client.ts`, hashes the project file
before and after the save and throws `AnnoSaveNotPersistedError` if the hash is **unchanged**
— explicitly "refusing to report success on the strength of the child's own text response."
That is the right instinct and an insufficient control, in both directions:
- **False negative:** an idempotent save (nothing changed since the last one) legitimately
  leaves the hash unchanged and is reported as a failure to persist.
- **False positive, and this is the dangerous one:** a hash that *changed* proves only that
  bytes moved. A bumped timestamp field, a rewritten header, or a **truncated** write all
  change the hash. A save that writes 4 KB of a 40 KB store and dies satisfies the control
  perfectly.

**Why it happens:**
Hash-delta is one line and reads as rigour. And the milestone's own bar is stated as "mutate →
kill → reopen must return the mutation", which a hash check superficially resembles.

**How to avoid:**
Implement exactly the stated bar and nothing weaker: **mutate → `SIGKILL` the process →
reopen from disk in a fresh process → read the mutation back by value.** Not `close()` then
reopen (that exercises the flush path the kill is meant to skip). Not same-process reopen (the
in-memory copy may answer). Not a hash comparison (proves bytes, not content). Keep a
structural read-back assertion on the *specific* annotation, plus a whole-store parse so a
truncated file is a parse failure rather than a partial success.

**Observing the control RED (this is the planted violation the milestone names):**
remove the save call — or, better and sharper, make the save write to the temp file and skip
the `rename` — and the mutate→kill→reopen test must fail. If it still passes, the test is
reading in-process state. A second planted violation worth running: truncate the store file to
half its length between kill and reopen; reopen must **refuse**, not return a partial store.

**Phase to address:** Phase 27 (Store core). This is the milestone's named durability bar and
it gates everything built on the store.

---

### Pitfall 12: tmp+rename is not `fsync`, and the claim must not exceed it

**What goes wrong:**
This repo has one atomic-write idiom, used in five places
(`anno-project.ts:339`, `refresh-manifest.ts:65`, `install-resources.ts:235`,
`incident-record.ts:338`, `vice-broker.mts:240`): write to `<target>.tmp-$pid-$now`, then
`renameSync`. It is the right idiom — a reader never observes a partial file, and a crashed
writer leaves the old file intact rather than a truncated new one. **None of the five calls
`fsyncSync`**, on the file or on the parent directory. So the guarantee is: durable against
*process* death (the data is in the page cache and survives `SIGKILL`); **not** durable against
machine crash or power loss, where `rename` may be visible while the data blocks are not.

**Why it happens:**
The distinction is invisible in testing, because the test kills a process, not a kernel.

**How to avoid:**
Keep the idiom (it is correct for the stated bar and consistent with five existing consumers —
extending a stable seam beats a parallel one). State the ceiling explicitly in the module header
and in the plan's verification wording: "durable across process death, proven; durable across
machine crash, not claimed." If crash durability is ever wanted, it is `fsync(fd)` before
`rename` plus `fsync(dirfd)` after — and it should be added with a stated reason, not silently.

**Warning signs:**
A completion claim reading "the store is durable" without a qualifier. A `writeFileSync`
directly to the target path anywhere (that one *is* torn-read-visible and must not exist).

**Phase to address:** Phase 27 (Store core). Enforce as a wording constraint at the phase gate,
per `ENGINEERING_RULES.md` §8 — the same discipline `DEBT-04`'s closure note used when it
declined to claim findings were fixed.

---

### Pitfall 13: Undo that does not survive the restart the durability test just proved

**What goes wrong:**
The two requirements are stated together — "undo and persistence" — and are usually
implemented apart. An in-memory undo stack passes every in-session test and is empty after the
reopen that Pitfall 11's test proves works. So the milestone ships a store where the durability
control is green, the undo control is green, and "undo the label I set before lunch" cannot be
done. Worse: an undo stack that persists *positions* but not *prior values* will happily
"undo" to whatever is there now.

**Why it happens:**
Undo is naturally a runtime concern and persistence is naturally a file concern, and the two
tests are written by different tasks.

**How to avoid:**
Persist the undo log in the store file, as an append-only list of inverse operations with the
prior value captured at write time, bounded and versioned with the schema. Then run **one**
combined planted-violation test rather than two separate ones: mutate → undo-able → `SIGKILL`
→ reopen → **undo** → assert the pre-mutation value. That single test cannot be satisfied by
in-memory state, cannot be satisfied by a persisted-position-only log, and cannot be satisfied
by a hash check.

**Observing the control RED:** drop the undo log from the serialised shape (keep it in memory)
and the combined test must fail. If only the separate tests exist, both stay green.

**Phase to address:** Phase 27 (Store core), as one criterion, not two.

---

### Pitfall 14: Concurrent writers — the in-process mutex is not a cross-process lock, and the staleness check is the thing most likely to be "cleaned up"

**What goes wrong:**
`anno-session.ts` holds a coarse FIFO mutex and a synchronous single-owner `inFlight`
check-and-set — **per proxy process**. That is not a lock on the file. Two real routes write the
same store from outside that mutex today:
1. `vice-mcp anno <verb>` — a genuinely separate OS process, invoked by a skill's Bash call
   (13 such mentions across the skills), with no access to the in-memory state at all.
2. A second `vice-proxy.ts` process (a second Claude Code session on the same project).

The recorded consequence, found live rather than reasoned about: a held session answered a
later read "from its now-stale in-memory copy, silently missing the import" — the same shape as
the mutate-then-read-across-connections incident named in the brief. The mitigation in place is
a cheap `mtimeMs` comparison before every reuse: mismatch ⇒ evict and reopen.

The pitfall for the owned store is that this mitigation looks like child-process bookkeeping.
The store is in-process now, "we own the file", so the check gets dropped — and the stale read
returns immediately, confidently, with no error.

**Why it happens:**
Owning the file feels like owning the writes. It does not: the CLI verbs and the second session
are still there, and last-writer-wins with tmp+rename produces a *clean* file that has silently
lost the other writer's annotations. No corruption to notice.

**How to avoid:**
- Keep a staleness check, and make it stronger than `mtimeMs`: a **monotonic `revision`
  counter inside the store file**, compared on every read-after-cache and asserted to have
  advanced on every write. `mtimeMs` has real holes (coarse granularity on some filesystems,
  and `cp -p`/archive extraction preserves it), and a revision integer has none of them.
- Refuse a write whose base revision is not the current on-disk revision — optimistic
  concurrency, one comparison — rather than overwriting. A refused write with a clear message
  is strictly better than a silent loss.
- Keep the single-owner check-and-set **synchronous with no `await` in the gap**, per the
  standing broker constraint (the 2026-08-01 triple-launch outage). Re-derive nothing locally.

**Warning signs:**
No revision/version field in the store file. A read path that returns cached data with no
freshness check. Two write paths (tool surface and CLI verb) with different serialisers.

**Observing the control RED:** open the store in process A, mutate it from process B, then read
from A. A must return B's value or refuse — it must not return the stale one. Remove the
revision check and this test must fail.

**Phase to address:** Phase 27 (Store core) for the revision field and the refusal; Phase 28
(MCP surface) for the CLI-verb/tool-surface single-serialiser rule.

---

### Pitfall 15: The grep gate fires on 236 legitimate mentions, or on a `.gitignore`d tree, or on neither

**What goes wrong:**
The `toacme` precedent is the right pattern and the wrong scope. Measured: **291 tracked files**
mention the external analyser; **55** outside `.planning/`. The remaining ~236 are roadmaps,
requirement documents, milestone records, decision rows and executed-phase artifacts that
**must** keep the word — permanently, because they are the historical record of a decision.
Meanwhile the precedent gate (`scripts/check-skill-fork-honesty.mjs`) walks only `src/skills/`,
`README.md`, `docs/stock-vice-parity.md` and `src/mcp/vice/` — its own comment admits the
narrow scope. Three distinct failures follow:

- **Too wide:** grep the tree, get 236+ hits, and the gate is switched off within a day. The
  gate script's own comment already names this dynamic: "Widening the scope to them would
  produce false positives and the guard would be switched off; keeping it narrow keeps it
  trusted."
- **Too narrow:** copy the precedent's scope and the gate never sees `docs/` (3 files),
  `scripts/` (11 files), `installer/`, `.claude-plugin/`, or the published tarballs — which is
  exactly the hole that made the `toacme` gate's bite on a **non-`SKILL.md`** file the lesson
  it was.
- **Wrong tree:** `installer/skills/` is `.gitignore`d generated output that currently holds
  **11** files mentioning the external analyser and **is shipped in the `@henols/c64-re-tools`
  tarball**. A filesystem grep fires on stale local output and reads as a real reintroduction;
  a `git grep` never sees it and the stale route ships to users.

**How to avoid:**
Define the gate as *tracked files, minus a named exemption set, plus the regenerated installer
tree*:
- Scope = `git ls-files`, excluding `.planning/**` (historical record, exempt by class not by
  file) — plus a `node installer/scripts/sync-skills.mjs` run followed by a grep of
  `installer/skills/**`, so the shipped copy is checked as generated output rather than as a
  source file. Equivalently, grep the `npm pack --dry-run` file list, which is what
  `scripts/check-npm-packages.mjs` already reasons about.
- Exemption set, named individually with a reason (never a pattern that could grow):
  the **5** `ATTRIBUTION (ABS-02)` blocks in `src/skills/` and their **5** synced twins;
  `THIRD-PARTY-NOTICES.md` in both packages (the MIT notice the attribution chain *requires* to
  stay); `src/skills/c64-program-recon/scripts/packer-finding.mjs`'s provenance strings
  (`entropySource = "anno_get_binary_info"` and the paragraph recording why no packer route
  existed) — these record what an *already-produced* finding was derived from and deleting them
  destroys provenance.
- Non-vacuity: assert the exemption set is non-empty **and** that each exemption still matches
  something. An exemption that matches nothing means the header it protected was deleted — the
  precise failure the brief warns about, caught mechanically instead of by review.

**Observing the control RED — three separate reds:**
1. Plant `the external analyser` in a non-`SKILL.md`, non-exempt file (a `.ts` under `src/mcp/vice/`,
   a `docs/*.md`, and a `scripts/*.mjs` — one each, since the `toacme` lesson was specifically
   about the non-obvious location). The gate must bite on all three.
2. Delete one `ATTRIBUTION (ABS-02)` block. The gate must **also** bite — on the exemption's
   own non-vacuity assertion — proving that "fixing" a false fire by deleting the header is
   itself caught.
3. Plant the string in `installer/skills/` *after* a sync. The gate must bite, proving the
   generated tree is in scope.

**Phase to address:** Phase 31 (The removal). The gate must be built and its three reds
observed **before** the deletion commit, not after — the audit-integrity precedent
(`4f048bb` closed a milestone with a guard already red and nothing forced anyone to notice) is
the reason.

---

### Pitfall 16: Guards that pass vacuously the moment their subject disappears

**What goes wrong:**
This is the highest-value removal pitfall in the milestone, because its symptom is a **green
suite** over an undefended invariant. Three concrete instances, all measured:

1. **`hostpath-consumers.test.ts`** derives the anno module family from disk —
   `topLevelProductionModules().filter(name => /^anno-.*\.ts$/.test(name))` — and asserts that
   family is **absent** from the host-path consumer set. It is well-built: it carries a
   `ANNO_MODULE_FLOOR` non-vacuity floor ("an empty or broken glob must fail loudly here
   rather than let the absence assertion below pass trivially") and a positive-control list of
   four named modules. So the deletion turns it **red** — correctly. The trap is the *repair*:
   lowering the floor to 0 and deleting the positive-control list converts a proven-non-vacuous
   guard into a permanently green one, and the **new** store modules (named
   `annotation-*`/`store-*`, not `anno-*`) are then covered by nothing. The container-side
   invariant this guard exists for applies to the new family identically.
2. **`scripts/check-skill-tool-coverage.mjs`** imports `CURATED_ANNO_TOOLS` from
   `anno-tools.ts` and cross-checks it against `anno_*` names extracted from skill prose,
   with a `ANNO_CLI_VERB_FLOOR` for the CLI verbs parsed out of `anno-cli.ts`'s own dispatch
   switch. After the deletion, zero mentions cross-checked against zero curated tools passes
   trivially — and the **82** re-pointed tool-name mentions in the skills are then validated
   against nothing.
3. **`skill-attribution.test.ts`** asserts its 5-row registry's length **equals** the phase-19
   manifest's absorbed-procedure count — a relation, not a magic number, which is right. It
   scans `src/skills/` only. Its 5 `destination:` rows all live there. It never looks at
   `installer/skills/`, so a sync that drops the headers is invisible to it.

**Why it happens:**
A derived-from-disk set is the correct pattern (it beats a hand-typed list), and it is exactly
the pattern that empties silently when the disk changes. The floor exists to catch that — and
the floor is the first thing a red-suite repair deletes.

**How to avoid:**
Give each of the 13 non-`anno-`named referencing test files an **explicit, recorded fate**
before the deletion commit: *re-point* (the invariant survives under a new name), *delete*
(the invariant is genuinely gone), or *keep-with-adjusted-expectation*. Written down, one line
each, in the plan. Specifically:
- Re-point the derived glob to the new family's prefix, **raise** the floor to the new family's
  size, and replace the positive-control list with modules from the new family. Then re-run the
  planted violation the guard already ships (a synthetic store-shaped source that *does* import
  `hostpath.ts` must be reported).
- Re-point the skill-tool-coverage map to the new store's curated tool list and keep a floor at
  or above today's 82 mentions / 17 distinct names, so an emptied extraction fails loudly.
- Extend the attribution guard to the synced `installer/skills/` tree, or add a sync-drift
  assertion — there is none today.

**Observing the control RED:** for each re-pointed guard, re-run its **own** planted violation
against the new subject. A guard whose floor was lowered rather than re-pointed will not be
able to go red, which is the test: if you cannot make it fail, you have not re-pointed it.

**Phase to address:** Phase 31 (The removal), as a gate precondition — the milestone's own
active requirement says "Every guard pinned to the deleted subject is given an explicit fate
before the phase gate, not discovered red in CI."

---

### Pitfall 17: CUT-02's reuse list under-names what survives, and each omission silently un-ships a capability

**What goes wrong:**
The reuse list names `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts`,
`anno-d64.ts`, `memmap.json`, `anno-regbits-gen.ts`, `anno-enum-gen.ts`. Measured against
the actual module set, **six** more carry capability the milestone intends to keep while
sitting on the delete side of the line:

| Module | Lines | What is lost, silently |
|---|---|---|
| `anno-test-gate.ts` | 166 | The ACME hard-fail switch CI binds to (Pitfall 10) |
| `anno-acme-ident.ts` | 97 | Legal-ACME-identifier rejection — the reject-never-sanitize rule (Pitfall 6) |
| `anno-confidence.ts` | 233 | The ONE five-grade confidence vocabulary the skills' prose and `memory-map.template.md` still instruct agents to emit (Pitfall 7) |
| `anno-symbols.ts` | 388 | The VICE label-file round trip — **`ANNO-14`/`ANNO-15`, a *Validated* requirement**, "demonstrated as one closed loop against genuine unpatched stock `x64sc`" |
| `anno-verify.ts` | 184 | The ACME-verdict parser and its two pinned false-pass transcripts (Pitfall 9) |
| `anno-memmap-render.ts` | 531 | `render-memmap --check` and the render-digest drift guard behind the Key Decision "make the store canonical and the Markdown memory map a generated view" |

Plus `anno-coverage.ts` (2,292 lines) whose split-table dispatch-context gate is the
expressiveness Pitfall 1 needs, even though the coverage *instrument* is correctly superseded.

**Why it happens:**
The reuse list was written at v0.6.0 scoping time against a different phase shape, and the
delete criterion is the `anno-` filename prefix — which these six share with genuine glue.
Nothing in the tree distinguishes "named anno because it talks to anno" from "named anno
because it was written in the anno phase".

**How to avoid:**
Classify all 16 non-test `anno-*.ts` modules explicitly — *glue* (delete), *capability*
(re-home under a non-anno name), *superseded* (delete, with the superseding thing named) —
before writing the deletion plan, and check each *capability* row against the Validated
requirements list in `PROJECT.md`. A module implementing a Validated requirement cannot be
deleted without a recorded decision to un-ship it.

**Warning signs:**
A deletion commit whose diff removes a module implementing a `✓`-marked requirement. A
`files[]` entry removed with no replacement. `THIRD-PARTY-NOTICES.md` losing an entry whose
attribution chain still needs it.

**Phase to address:** Phase 27–29 for the re-homing (each capability lands where it is used);
Phase 31 for the deletion, which then removes only glue and superseded code.

---

### Pitfall 18: The reds the deletion *will* produce, mistaken for defects and repaired by weakening

**What goes wrong:**
Three guards go red by construction when the deletion lands, and each has an obvious wrong fix:

1. **`docs-linerefs.test.ts`** extracts `vice-proxy.ts:<N>` citations from `CLAUDE.md`'s
   `rewriteArguments()` bullet and asserts the cited line **really is** a call site or function
   start. The anno wiring in `vice-proxy.ts` sits at roughly `:188-310` (subcommand dispatch,
   `ANNO_TOOL_DEFINITIONS` import, drain timeout) and `:3163-3186` (session close) — i.e.
   ~120 lines *above* the cited `:1507`/`:1531`, and more above `:2987`/`:3052`. Removing them
   shifts all four. Wrong fix: loosen the guard to a regex-only check. Right fix: re-cite
   CLAUDE.md — the constraint bullet itself says "treat a mismatch as drift to re-verify, not
   as evidence the constraint itself changed."
2. **`docs-dangling-refs.test.ts`** scans a fixed normative document set —
   `.planning/ROADMAP.md`, `CLAUDE.md`, `README.md`, `docs/roadmap-stock-vice.md`,
   `docs/stock-vice-parity.md` — and **fails if any of them is missing** ("a missing one FAILS
   rather than silently shrinking the scanned set"). `CLAUDE.md` currently carries four
   the external analyser constraint bullets that must be rewritten, and `docs/` cleanup may touch a
   scanned file. Wrong fix: remove the path from the list. Right fix: rewrite the content.
3. **`docs-absorbed-decisions.test.ts`** pins **D-36** (the `anno_get_address_details`
   client-side composition) read out of the live `PROJECT.md`, with a stated reversal trigger
   on an upstream issue. Deleting the subject makes the pinned decision moot but the guard
   still asserts the text exists. Wrong fix: delete the guard *and* the decision row. Right
   fix: keep the decision row as history (decisions are dated records, not live config) and
   give the guard an explicit superseded-by fate — the same treatment `FORK-01` and `CORE-01`
   get from their own guards.

**Why it happens:**
A red suite during a large deletion reads as noise, and the cheapest way to green is to narrow
the assertion. `ENGINEERING_RULES.md` §5 names every variant of this ("never make verification
green by weakening the verifier"), which is why it is listed as a pitfall rather than assumed
away.

**Observing the control RED:** these three are *already* the red. The discipline is to record,
before the deletion, that they are **expected** to go red and how each will be repaired — so a
red that was *not* predicted is distinguishable from one that was.

**Phase to address:** Phase 31 (The removal), as a pre-declared expected-failure list in the
plan.

---

### Pitfall 19: Manual-only tests hide the breakage until CI

**What goes wrong:**
`vice-proxy.test.ts` holds **29** anno references and is a member of `MANUAL_ONLY_TESTS`
(9 files). `npm run test:automated` excludes it. CI runs the **full** `npm test` glob
deliberately ("CI's set is deliberately wider than `npm run test:automated`"). So a deletion
that breaks the proxy's anno wiring can be locally green through `test:automated` and red in
CI — after the commit, on a branch, with the removal already landed.

**Why it happens:**
`test:automated` is the fast loop and the natural thing to run during a 25k-line deletion.
This project has been bitten before: the recorded lesson is that `test:automated` skips
`MANUAL_ONLY_TESTS` and therefore hides failures.

**How to avoid:**
Run the full `npm test` — not `test:automated` — at every task boundary in the removal phase,
and state which one was run in the completion evidence. Note also that a **live broker**
reddens an unrelated test deterministically, so stop the broker before trusting a full-suite
result.

**Warning signs:**
A completion note citing `test:automated`. A test count that dropped by more than the deleted
files account for.

**Phase to address:** Phase 31 (The removal) — as a verification-command constraint, since
`ENGINEERING_RULES.md` §17 already requires the repository's own scripts.

---

### Pitfall 20: Orphaned fixtures, evidence trees, and packaging manifests

**What goes wrong:**
The satellite surface around 25,759 deleted lines:
- **`src/mcp/vice/fixtures/coverage/`** — 212 KB, 12 named fixture directories, each a
  `project.regen2000proj` + `store.json` pair, plus its own generator
  `make-coverage-fixtures.mjs` and a `README.md`. Owned entirely by `anno-coverage.test.ts`.
  Deleting the test and keeping the fixtures leaves 212 KB of unreferenced binary-ish data that
  the next person cannot classify. Deleting the fixtures and keeping the generator is worse —
  a generator producing input for nothing.
- **`package.json` `files[]`** — **19** anno entries (`anno-launch.ts` … `anno-coverage.ts`,
  plus `anno-regbits.json`). npm **silently ignores** a `files[]` entry naming a nonexistent
  file, so a stale list does not error; the tarball just quietly differs from the manifest.
  `scripts/check-npm-packages.mjs` validates tarball contents via `npm pack --dry-run --json`
  against an expected set, so it will catch a *removed* file it still expects — provided its
  own expectation list is updated in the same commit rather than after.
- **Live `.planning/phases/` readers** — five tests read paths under `.planning/phases/`:
  `anno-derivation.test.ts` and `skill-attribution.test.ts` (both hard-code
  `phases/19-…/upstream-procedure-manifest.json`), `absorbed-answer-key.test.ts`
  (`phases/11-…/evidence/`, **no existence guard**), `anno-coverage.test.ts`
  (`phases/19-…/evidence/coverage-reproducibility`), `anno-verify.test.ts`
  (`phases/10-…/evidence/10-verify-transcript.txt`). Three of the five die with their subject;
  `skill-attribution.test.ts` must survive and keeps its phase-19 dependency. And the
  milestone's own "derive the tool surface from `upstream-procedure-manifest.json`" makes that
  phase-19 file an **input to this milestone's design**, not just a test fixture.

**Why it happens:**
Fixtures and evidence live outside the module tree, so a prefix-driven deletion never touches
them; and packaging manifests fail *quietly* by design.

**How to avoid:**
Enumerate the satellite surface in the deletion plan as its own task list: fixture directories,
`files[]` entries, `check-npm-packages.mjs` expectations, the `.planning/phases/` readers, the
`scripts/` consumers (`check-skill-tool-coverage.mjs`, `lib/anno-cli-verbs.mjs`), and
`THIRD-PARTY-NOTICES.md` in **both** packages. Then re-run `scripts/check-npm-packages.mjs`
and `scripts/package.sh` as a gate. Do **not** archive phase directories at the v0.7.0 close
(`--no-archive-phases`), for the same reason recorded as a standing Key Decision — and note the
reason has grown: the phase-19 manifest is now a design input, not only a guard's fixture.

**Observing the control RED:** delete a file that is still in `files[]` and confirm
`check-npm-packages.mjs` **fails**. If it passes, its expectation list is stale and the
packaging gate is vacuous.

**Phase to address:** Phase 31 (The removal).

---

### Pitfall 21: Re-pointing prose and forgetting the script, the template, and the CLI verbs

**What goes wrong:**
The five absorbed procedures are written against `anno_*` calls in **five files**, and they
are not all prose:
- `c64-program-recon/SKILL.md` (27 mentions) and `c64-memory-mapping/SKILL.md` (36) —
  playbook prose. Re-pointing is an edit.
- `routine-queue-walker/SKILL.md` (14) — playbook prose, and the whole skill's *procedure* is
  a queue walk over store queries; its every step is a tool call.
- `c64-program-recon/templates/memory-map.template.md` (3) — a **template an agent copies into
  a project**. A stale route here propagates into every future project's memory map and is not
  visible in the skill that produced it.
- `c64-program-recon/scripts/packer-finding.mjs` (2) — **executable code**. One mention is a
  recorded provenance value (`entropySource = "anno_get_binary_info"`), the other a paragraph
  explaining why no packer route existed upstream. Re-pointing prose leaves this script's
  runtime behaviour and its recorded provenance to be handled separately.
- Plus **13** `vice-mcp anno <verb>` CLI-verb mentions across the skills, which are Bash
  invocations, not MCP tool calls, and are therefore invisible to a tool-name grep.

**Why it happens:**
"Re-point the skills" reads as an editing task on three `SKILL.md` files. The measured surface
is 5 files, 2 mention *kinds* (MCP tool names and CLI verbs), and 3 content kinds (prose,
template, executable).

**How to avoid:**
Derive the work list mechanically rather than by reading: `grep -ro "anno_[a-z_]*"` and
`grep -rn "vice-mcp anno"` over `src/skills/`, and treat the union as the checklist. Keep the
existing coverage gate pointed at the new surface (Pitfall 16) so a mention with no
corresponding tool is a **failure**, not a documentation bug found later. For the 17 distinct
tool names, decide each against the phase-19 manifest's `curated`/`omit`/
`adapt-to-address-input` classification — which is the milestone's stated method, and is a diff
rather than a judgement call.

**Warning signs:**
A skill naming a tool that does not exist in the new surface (this is what makes the gate
load-bearing). `templates/` untouched by the re-pointing diff. `packer-finding.mjs` untouched.

**This symptom is inert knowledge, not an error.** The playbook still reads correctly and the
heuristics are intact; the procedure simply cannot be executed. Nothing reports it — the agent
calls a tool, gets "unknown tool", and improvises.

**Phase to address:** Phase 30 (Skill re-pointing), which must precede Phase 31 (The removal) —
otherwise the removal lands with 82 dangling references and the gate cannot distinguish
"not yet re-pointed" from "reintroduced".

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Ship the 7-type vocabulary as literally stated | Smaller schema, faster Phase 27 | Re-creates the `da65` expressiveness boundary the project rejected `cc65` for; a schema migration once real data exists | **Never.** The vocabulary is `DECOMP-01`'s sizing input and the one irreversible decision in the milestone |
| Undo stack in memory only | Undo "works" in one session; no serialisation design | The durability control and the undo control are both green over a store that cannot undo across a restart | Never — the combined planted-violation test costs one test, not one phase |
| Hash-delta as the persistence proof | One line, reads as rigour | A truncated save passes; an idempotent save fails | Only as a *supplement* to the mutate→kill→reopen read-back, never instead of it |
| Verify export by string-matching the exporter's own output | No ACME needed, runs in CI unconditionally | This is the same-pass fixture failure the project has been taught six times; the Phase 4 opcode table was internally pinned and still shipped 14 wrong entries | Never for a reassembly claim. Acceptable for *formatting* assertions, labelled as such |
| Delete `anno-*`-prefixed modules by prefix | 25,759 lines in one commit | Six capability modules and a Validated requirement go with them (Pitfall 17) | Never. Classify first, delete second |
| Lower a non-vacuity floor to green a red suite | Immediate green | A permanently-green guard, and `ENGINEERING_RULES.md` §6's "a permanently-green test is not evidence" | Never. Re-point, then re-plant the violation |
| Keep the store single-process-only, no revision check | No concurrency design | Silent annotation loss across two sessions or a CLI verb; a clean file with missing findings | Only with the limitation stated in the module header and the tool description, and a refusal rather than a silent overwrite |
| Skip `fsync` | Matches five existing call sites; simpler | Machine-crash durability is not held | **Acceptable** — with the ceiling stated. Consistency with the existing idiom beats a lone divergence |
| Archive phase directories at the v0.7.0 close | Tidier `.planning/` | Reds `skill-attribution.test.ts` and removes this milestone's own tool-surface derivation input | Never, until both readers can read the archive |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| **Real ACME 0.97** | Deriving the verdict from the exit code, or from an aggregate "all passed" line | Parse the per-assembler result line; treat "did not run" as a third outcome; byte-diff for identity. Both false-pass directions must be re-proved (Pitfall 9) |
| **Real ACME — illegal opcodes** | Emitting a mnemonic for an opcode ACME cannot assemble. 221/256 opcodes are assembler-expressible under `!cpu 6510`; the remaining 35 are not | Emit `!byte $xx` with a comment naming the opcode; never invent a mnemonic. Round-trip byte-identity is the check, and it is the exact instrument that caught 14 wrong entries in an internally-verified table |
| **Real ACME — `=*+$01`** | Treating the mid-instruction label idiom as an origin directive (`*=`) rather than a label definition, or emitting it at the instruction start instead of the operand byte | It names the **operand byte** of a self-modifying write. Emitted wrong it either fails to assemble (fine) or relocates the following code (silent, catastrophic). Verify by byte-identity, on a fixture that *contains* self-modifying code — the pivot fixture has one |
| **Real ACME — layout** | Assuming reassembly preserves addresses. A label substituted for a zero-page literal changes the addressing mode and the instruction **length**, shifting everything after it | Assert `*` equals the original address at the start of every block, not only at the program start. Byte-identity catches it; a "reassembles clean" assertion does not |
| **CI's ACME provisioning** | Assuming the `acme` on `PATH` is ACME. CI already greps the binary's own banner because a name is not proof | Keep `probeAcme()`'s banner check; keep `VICE_REQUIRE_ACME` turning absence into a FAIL (Pitfall 10) |
| **`memmap.json`** | Flat lookup, first-match, or description-length selection; lookup inside the loaded image; address resolved before bank state | All four rules, all four silent. `memmap.json` is **more** load-bearing after the pivot, and is pinned by `memmapSha256` in the enum generator — a store that copies its data instead of joining against it forks the truth |
| **MCP tool-surface compatibility** | Adding the store to `tools-manifest.json` and reddening the fork's byte-identity regression gate; or registering proxy-locally and never telling the user the tools exist | The `anno_*` family was in **neither** the manifest nor `capability-registry.ts`. STORE-03's registry declaration is new: check all four registry consumers and the generated `docs/tool-support.md` drift guard before choosing |
| **`buildViceTool()` / `forwardToVice()`** | Registering a store tool behind `call()`, where `rewriteArguments()` has already host-translated its paths | Register proxy-locally exactly as the `anno_*` family does, so the constraint is satisfied **by construction**. Both `rewriteArguments()` call sites are then unreachable — and the CLAUDE.md line citations must be re-verified after `vice-proxy.ts` shrinks (Pitfall 18) |
| **The store's project path** | Accepting a caller-supplied path and resolving it anywhere but the one seam | `resolveStorePath()`'s job today: resolve against `repoRoot()` only, `realpathSync` before use, refuse escape. Container-side, so **no** host-path translation module may be imported — asserted structurally by the derived-from-disk consumer-set guard, which must be re-pointed at the new family (Pitfall 16) |

---

## Performance Traps

Scale here is a 64 KB address space and a handful of concurrent sessions, so "performance" means
"a data structure whose wrong shape produces a wrong answer or an unusable latency in an
interactive agent loop", not throughput.

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| One record per byte | 65,536-entry arrays serialised on every save; a multi-MB store file for a 40 KB program; save latency inside an agent's tool call | Store **ranges**, not bytes. The census may expand to bytes in memory; the file never does | Immediately on a full 64 KB image — which is the normal input, not the edge case |
| Linear scan for range lookup, called per instruction during export | Export time quadratic in annotation count; "the exporter is slow" filed as a UX bug | Sort ranges once and binary-search, or build a boundary index at load. The narrowest-containing-range rule needs an ordered structure anyway | A few thousand ranges — reachable on one real cracked release |
| Full-store rewrite on every mutation | Every `set_comment` writes the whole file; an agent setting 200 comments writes 200 full stores | Batch, or make the save explicit (upstream's `save_project` shape). Whatever the choice, the durability bar still applies to the last mutation | A `routine-queue-walker` pass, which is exactly the designed workload |
| Cross-reference search over the whole typed decode, recomputed per query | Multi-second `search_disassembly`; the agent stops using the store and re-derives (the `CORE-01` reversal condition (a) failure) | Cache the decode keyed on `(image hash, revision)`, invalidate on the revision counter that Pitfall 14 already requires | A 64 KB image with a few hundred queries — one recon session |
| Undo log unbounded | Store file grows without limit; reopen slows; the log dominates the file | Bound it, with the bound in the schema and the drop recorded rather than silent | A long session; harmless until the file is the artifact someone diffs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Accepting a caller-supplied store path without resolution and containment | An LLM-driven tool writes a file anywhere the process can reach; path traversal via `..`, a symlink, or an absolute path | One seam resolves against `repoRoot()`, `realpathSync` before use, refuse anything outside the workspace — the discipline `resolveStorePath()` already implements and `PathOutOfWorkspaceError` already names |
| Importing a host-path translation module into the store family | Breaks the container-side invariant and the tested closed consumer set; a path is translated for a process that never leaves the container | The derived-from-disk absence guard, **re-pointed** at the new family with its floor raised (Pitfall 16) |
| A `tools_call`-shaped meta-tool on the store surface (batch execute) | Nested-argument smuggling past the deny-list — the exact shape `vice.ts`'s `DENY_LIST` exists to close | If a batch tool is offered, gate every inner name through the same curated-name assertion, recursively, before anything executes. One sanctioned exception, guarded, is the existing precedent |
| Trusting store content as trusted input | Store comments/labels are first-party **untrusted** prose (an agent wrote them). Rendering them into ACME source, or into a shell command, without escaping | Treat store text as data. Labels are validated identifiers (reject, never sanitize); comments are escaped at emit; nothing from the store reaches a shell |
| Leaving the `--vice` denial removed along with its subject | The invariant becomes moot for anno but the *pattern* (a static-analysis surface that must never reach the emulator) transfers to the new store | Record the fate explicitly: the spawn-seam guard's frozen set is genuinely empty after the removal (no child process exists), and the deny-list entry is reviewed rather than reflexively deleted |

---

## Agent-UX Pitfalls

The consumer is a Claude session, not a human. The failure modes are about what the agent
*believes*.

| Pitfall | Agent Impact | Better Approach |
|---|---|---|
| A tool answering "saved" from its own return value | The agent reports the finding as durable and moves on; the next session finds nothing. This is `saveAndVerify()`'s founding observation, one layer in | The tool's success path is a read-back, not a report. Never report persistence on the strength of the writer's own message |
| A retype returning bare success while orphaning comments | The agent believes its earlier annotations survived; they are inert or contradictory | Return the affected-comment list in the result (Pitfall 7). An agent given a list will fix it; an agent given `{ok:true}` cannot |
| Silent decline where bank state is path-dependent | An agent that gets no comment assumes none was needed | Return an explicit "declined, bank state path-dependent at `$xxxx`" record. `AUTO-05`'s decline must be *visible*, or it reads as coverage |
| A missing tool answered with "unknown tool" | After the removal, an un-re-pointed playbook step gets an opaque failure and the agent improvises — usually by re-deriving from bytes, the exact cost the store exists to remove | The coverage gate (Pitfall 16) makes a dangling mention a **build** failure. For genuinely retired tools, refuse **by name** with the replacement named — the precedent `capability-registry.ts` sets for the three fork-only capabilities |
| A stale read after an external write | The agent answers from a store that has moved. Nothing is wrong-looking about the answer | Revision-counter freshness check on every cached read (Pitfall 14) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Per-range typing:** often missing the split-table orientation and element-kind variants —
      verify a `lo_hi_address` fixture and a `hi_lo_address` fixture of the same bytes produce
      **different** resolved targets.
- [ ] **Range model:** often missing the split-on-overwrite case — verify total typed-byte count
      is unchanged after a fully-contained retype.
- [ ] **Persistence:** often proved by a same-process reopen or a hash delta — verify by
      `SIGKILL` and a **fresh process**, reading the mutation back by value.
- [ ] **Undo:** often in-memory only — verify undo **after** the kill-and-reopen, in one test.
- [ ] **Concurrency:** often single-process only — verify a write from a second process is seen
      or refused, never silently overwritten.
- [ ] **ACME export:** often verified against the exporter's own string output — verify by real
      ACME **and** byte-diff, and verify the "ACME absent" path FAILS under
      `VICE_REQUIRE_ACME=1`.
- [ ] **Self-modifying write targets:** often absent from the fixture entirely — verify the
      `=*+$01` idiom on a fixture that actually contains self-modifying code.
- [ ] **Illegal opcodes:** often only tested on the 221 expressible ones — verify a fixture
      containing one of the 35 inexpressible bytes round-trips byte-identically as `!byte`.
- [ ] **Grep gate:** often scoped to playbooks — verify it bites on a planted `.ts`, a planted
      `docs/*.md`, and a planted `scripts/*.mjs`, and that deleting an `ATTRIBUTION (ABS-02)`
      block **also** trips it.
- [ ] **Guard fates:** often "the suite is green" — verify each re-pointed guard can still be
      made to **fail** against its new subject. A guard you cannot redden is not re-pointed.
- [ ] **Skill re-pointing:** often prose only — verify `templates/memory-map.template.md`,
      `scripts/packer-finding.mjs` and the 13 CLI-verb mentions are in the diff.
- [ ] **Packaging:** often stale `files[]` — verify `scripts/check-npm-packages.mjs` **fails**
      when a listed file is absent, then verify it passes on the real tree.
- [ ] **Full suite:** often `test:automated` — verify with `npm test` (the CI glob), with the
      broker stopped.
- [ ] **Line citations:** often stale after `vice-proxy.ts` shrinks — verify
      `docs-linerefs.test.ts` green with the **re-cited** numbers, not a loosened assertion.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Type vocabulary too narrow, data already exists | **HIGH** | Schema migration over live annotation stores; split-table orientation is unrecoverable from stored data (it was never recorded) and must be re-derived or re-annotated. This is why it is the one decision to get right in Phase 27 |
| Range model drops instead of splits | MEDIUM | Fix the seam; the lost typing is unrecoverable but re-derivable from the engines later. Add the byte-accounting invariant so it cannot recur |
| Undo not persisted | LOW | Serialise the log; the missing history for existing stores is simply absent, stated rather than backfilled |
| Silent annotation loss from concurrent writes | MEDIUM–HIGH | Unrecoverable per-loss. Add the revision refusal, then re-annotate. Detectable retroactively only if the other session's transcript survives |
| ACME verification was never actually running | MEDIUM | Re-run the full export corpus under real ACME; every claim made in the window drops to fixture level and must be re-worded, per `ENGINEERING_RULES.md` §8 |
| Guard lowered to green rather than re-pointed | LOW to fix, HIGH if undetected | Restore the floor, re-point the glob, re-plant the violation. The tell is a guard that cannot be made to fail |
| Deletion removed a capability module | LOW | `git revert` the file; the removal is one commit and the history is intact. Cheap **only if noticed** — which is why the capability/glue classification precedes the deletion |
| A skill left pointing at a deleted route | LOW | Re-point; but until noticed, every session using that skill re-derives from bytes. The coverage gate is what converts this from "noticed eventually" to "noticed at build" |
| Phase directories archived at the close | LOW | Restore from git; but note the milestone's own design input lives there |

---

## Pitfall-to-Phase Mapping

Phase numbers are **proposed roles**, not a roadmap — `PROJECT.md` records that v0.7.0
numbering starts at **27** and that numbers are never reused. A roadmapper should map the roles,
not the digits.

| Pitfall | Prevention Phase (proposed role) | Verification — and what RED looks like |
|---|---|---|
| 1. Narrow type vocabulary | **27 — Store core** | Same-bytes lo-hi vs hi-lo fixtures resolve to different targets. RED: collapse to one `table` type and the target-set inequality fails |
| 2. Inclusive-end off-by-one | 27 — Store core | One-byte range reports length 1; `$FFFF` handled. RED: switch the model to exclusive |
| 3. Partial overwrite | 27 — Store core | Total typed bytes unchanged across all five overlap cases. RED: replace split with filter-and-insert |
| 4. Address/offset/hex | 27 — Store core | `.prg` and flat-64K of one program annotate identically. RED: reintroduce the 2-byte skew |
| 5. Flat vs banked | 27 (reserved field + schema version); resolution stays with held 26 | Schema carries `bank` and a version; unqualified I/O annotations documented as bank-scoped. RED: n/a this milestone — record the ceiling instead of claiming coverage |
| 6. Label collisions / sanitising | 27 (rejection) + 29 (ACME confirmation) | Duplicate name refused; real ACME reports duplicate-symbol with the refusal removed |
| 7. Comment anchoring on retype | 27 — Store core | Retype returns the contradicted-comment list. RED: drop the check and the call returns clean success |
| 8. Enum on the wrong operand | **29 — ACME export** | `lda #$1b`/`sta $d011` renders with the enum and reassembles byte-identical. RED: allow application to an address operand |
| 9. The `--verify` seam cannot be reused | **29 — ACME export**, before 31 | Two reds: missing-ACME must not pass; a corrupted byte must fail while ACME exits 0 |
| 10. `anno-test-gate.ts`'s ACME half | 27 (earliest) / 29 (latest), before 31 | `VICE_REQUIRE_ACME=1` + bogus `ACME_BIN` must **FAIL**, not skip |
| 11. Hash-delta as durability | 27 — Store core | mutate → `SIGKILL` → fresh-process reopen → read back. RED: skip the `rename`; also truncate-and-reopen must refuse |
| 12. tmp+rename ≠ `fsync` | 27 — Store core | Wording gate at the phase boundary: "durable across process death" only |
| 13. Undo across restart | 27 — Store core | One combined test: mutate → kill → reopen → **undo** → assert prior value. RED: keep the log in memory |
| 14. Concurrent writers | 27 (revision) + 28 (single serialiser) | Cross-process write is seen or refused. RED: remove the revision check |
| 15. Grep-gate scope | **31 — The removal**, gate built first | Three plants bite (`.ts`, `docs/`, `scripts/`); a deleted `ATTRIBUTION` block also bites; a plant in the synced `installer/skills/` bites |
| 16. Vacuous guards | **31 — The removal**, as a gate precondition | Each re-pointed guard re-runs its **own** planted violation. RED: a guard that cannot be made to fail |
| 17. Under-named reuse list | 27–29 (re-homing) then 31 (deletion) | All 16 non-test modules classified glue/capability/superseded; no `✓`-Validated requirement un-shipped without a decision |
| 18. Expected reds mistaken for defects | 31 — The removal | A pre-declared expected-failure list; `docs-linerefs` green on **re-cited** numbers |
| 19. `test:automated` hides it | 31 — The removal | Full `npm test`, broker stopped, command named in the evidence |
| 20. Orphaned fixtures/manifests | 31 — The removal | `check-npm-packages.mjs` fails on a missing listed file, then passes; `package.sh` green; `--no-archive-phases` at the close |
| 21. Skills re-pointed incompletely | **30 — Skill re-pointing**, before 31 | Mechanically derived 82-mention + 13-verb checklist fully consumed; coverage gate red on any dangling mention |

**Ordering consequences the roadmapper should treat as hard:**

1. **The removal is last.** Phase 31 after 30, and 30 after the surface exists (28) — otherwise
   the grep gate cannot distinguish "not yet re-pointed" from "reintroduced", and the milestone's
   own gate requirement becomes unenforceable.
2. **The ACME gate module and the ACME producer must be re-homed before the deletion**, not
   after. Between them there is a window with no working external oracle, and every claim made
   in it sits at fixture level.
3. **The store's type vocabulary is the first irreversible decision.** It is `DECOMP-01`'s
   sizing input (deferred to v0.9.0) and the thing a schema migration cannot recover.
4. **Build every gate before the thing it gates.** The `4f048bb` precedent — a milestone closed
   with a guard already red and nothing forcing anyone to notice — is the reason Phase 12 was
   sequenced first in v0.4.0, and the same argument applies to Phase 31's grep gate and guard
   fates.

---

## Sources

All findings below were produced by direct inspection of this repository's working tree on
2026-08-26 — commands, not recall. No external provider was consulted: the question is about
*this* codebase's integration and removal surface, for which the repository is the primary
source and the strongest available one.

- **Store semantics and vocabulary:** `src/mcp/vice/anno-tools.ts` (tool schemas, the 12-type
  `data_type` enum, inclusive range wording, `CURATED_ANNO_TOOLS`, `resolveStorePath()`,
  batch-recursion gate), `anno-project.ts:339` (tmp+rename), `anno-session.ts`
  (FIFO mutex, `inFlight`, `mtimeMs` staleness, restart budget, the two deliberate absences),
  `anno-mcp-client.ts:780-795` (`saveAndVerify()`), `anno-confidence.ts`
  (five-grade vocabulary), `anno-acme-ident.ts`, `anno-coverage.ts` (census header, the
  dispatch-context gate, its six named traps).
- **Export/reassembly:** `anno-verify.ts` (the D-10 false-pass transcript, the WR-04 unanimity
  fix, `AssemblerOutcome`), `anno-test-gate.ts` (both gates, `VICE_REQUIRE_ACME`),
  `disasm-roundtrip.test.ts`, `src/skills/acme-build/scripts/acme.mjs:124`,
  `.github/workflows/ci.yml:45-140` (ACME install, banner grep, `VICE_REQUIRE_ACME: "1"`,
  the deliberate `npm test` over `test:automated`).
- **Removal surface:** `wc -l` over `anno-*.ts` (10,102 non-test + 15,657 test);
  `git grep -l the external analyser` (291 tracked / 55 outside `.planning/`);
  `.gitignore:43` (`/installer/skills/`) with 11 mentions in the generated tree;
  `package.json` `files[]` (19 anno entries); `scripts/check-skill-fork-honesty.mjs` (its
  actual walk scope and its own comment on that scope); `skill-honesty-checks.test.ts`
  (the `toacme` gate's live child-process plants and its check-ordering regression);
  `scripts/check-skill-tool-coverage.mjs` + `scripts/lib/anno-cli-verbs.mjs`
  (`CURATED_ANNO_TOOLS` import, `ANNO_CLI_VERB_FLOOR`);
  `hostpath-consumers.test.ts:173-240` (derived glob, `ANNO_MODULE_FLOOR`, positive control,
  planted violation); `skill-attribution.test.ts` (5-row registry, manifest-length relation,
  `src/skills/`-only scope); `docs-linerefs.test.ts`, `docs-dangling-refs.test.ts:39-56`,
  `docs-absorbed-decisions.test.ts`; `test-gate.mjs:95-105` (`MANUAL_ONLY_TESTS`);
  `ci-suite-coverage.test.ts:68-74` (`installer/skills` as gitignored generated output);
  `src/mcp/vice/fixtures/coverage/` (12 dirs, `store.json` + `project.regen2000proj`,
  `make-coverage-fixtures.mjs`).
- **Skill surface:** `grep -ro "anno_[a-z_]*" src/skills` (82 mentions / 17 distinct names
  across 5 files), `grep -rn "vice-mcp anno" src/skills` (13), the five
  `ATTRIBUTION (ABS-02)` blocks and their five synced twins.
- **Project record:** `.planning/PROJECT.md` (Current Milestone v0.7.0, the two scope decisions
  of 2026-08-26, Constraints, Key Decisions incl. `--no-archive-phases`, `FORK-01`, `CORE-01`,
  `D-36`), `.planning/REQUIREMENTS.md` (`STORE-01..06`, `CUT-01..03`, `AUTO-01..07`),
  `.planning/ENGINEERING_RULES.md` §§5-8, 11, 17-19, `CLAUDE.md` constraints,
  `.planning/notes/auto-annotation-from-ghidra-xrefs.md` (the four silent join rules).

---
*Pitfalls research for: owning the annotation store and removing the external analyser (v0.7.0)*
*Researched: 2026-08-26*
