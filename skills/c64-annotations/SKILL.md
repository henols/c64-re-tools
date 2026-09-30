---
name: c64-annotations
description: Write, read and export the annotation project of a C64 program through the `anno` CLI verbs and the `anno_*` calls. The project holds labels, comments, data types, scopes and enums in the committed `.c64-re-tools/annotations.db`. Use when asked to write a label, comment or data type into the annotation project, or to read back annotations. Also use when asked to import a Ghidra export, create or apply an enum, or export annotated assembly. Also use when asked to render the memory map from its sidecar, or to report annotation coverage or what is still undocumented.
---

# The annotation project

**Write every finding into the project with an `anno` call. Never write it only
into Markdown.** The project is the one source of truth. The memory map and the
exported assembly are views that a verb generates from it.

```bash
A="node src/mcp/vice/vice-proxy.ts anno"   # in-repo form, from the repo root

$A call anno_set_label_name --args '{"address":"$1103","name":"irq_handler"}'
$A call anno_get_symbols --args '{"max_results":500}'
$A export-asm game.prg --out game-src
$A coverage game.prg
```

The full argument list of every `anno_*` call is in
[`references/tools.md`](references/tools.md).

## How to run an anno verb

Three forms run the same code:

| Install | Command |
|---|---|
| Plugin | `node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>` |
| This repo | `node src/mcp/vice/vice-proxy.ts anno <verb>` |
| npm package | `vice-mcp anno <verb>` |

The CLI has nine verbs: `call`, `render-memmap`, `coverage`, `export-asm`,
`evid-disagreements`, `decomp-completeness`, `hazard-report`,
`export-project` and `import-project`. `--help` prints the usage of each verb.

The `anno_*` names are not MCP tools. You reach each one through the `call` verb:

```bash
$A call <name> --args '<json object>'
$A call <name> --args-file batch.json      # for a large object, e.g. anno_batch_execute
```

- The JSON object carries the argument names that `references/tools.md` gives.
- Give `--args` or `--args-file`, not both.
- On success, `call` prints the JSON answer and exits 0.
- On a refusal or a failure, `call` prints `[<ErrorClass>] <name> refused|failed: <message>` on stderr and exits 1.
- A verb refuses an option that it does not read. It names the flag and the accepted set.

**Addresses.** Give an address as an integer 0..65535, a `"$hex"` string or a
`"0x"` string. The call refuses an unprefixed numeric string, such as `"1234"`.
A wrong base in a stored address stays wrong and silent.

**Paths.** Every file argument is absolute or relative to the workspace root.
The client refuses a path outside the workspace root, also through a symlink.

## Where the project lives

Each project has one SQLite file: `<workspace>/.c64-re-tools/annotations.db`.

- The client opens the file in its own process for each call, and then closes it.
  The broker does not open it.
- The workspace root comes from `CLAUDE_PROJECT_DIR`, then
  `CONTAINER_WORKSPACE_PATH`, then the nearest `.git` ancestor.
- **Commit the file** with the project. Then branches, clones and reviews carry
  the findings. Each worktree and each clone has its own file.
- No call takes a `store` argument. The client refuses a call that gives `store`.
- The file holds exactly one project. The client refuses a file with more than one project.

`c64-project` describes the rest of the `.c64-re-tools/` folder.

**Text copy.** The file is binary, so git shows no diff for it.

```bash
$A export-project --out annotations.json          # add --force to replace the file
$A import-project annotations.json                # fills an EMPTY project only
```

`export-project` writes every range, label, comment, enum, cross-reference,
observation, scope and exclusion as one JSON document. The test fixtures use this format.
`import-project` writes all rows in one transaction, or it writes none. It
refuses a project that holds any annotation. It never merges.

## Open or create the project

There is no bootstrap verb. The first write creates `annotations.db` and its
project. `anno_set_label_name`, `anno_set_comment`, `anno_set_data_type` and
`anno_add_scope` are examples of a first write.

The client refuses a read before the first write:

```
this workspace has no annotation project yet (<path> does not exist) -- nothing has been annotated here, so there is nothing to read. The first write creates it.
```

This refusal tells "I read nothing" apart from "there is nothing to read".

### The `image` argument rule

The project holds annotations. It never holds program bytes. Thus every call
that derives its answer from the bytes needs an `image` path:

- `anno_get_binary_info`
- `anno_read_region`
- `anno_disassemble`
- `anno_get_cross_references`
- `anno_search`
- `anno_get_address_details`
- `anno_join_memmap`
- `anno_hazard_report`

The client reads the file and sends its bytes with the call. If you omit the
image, the client refuses the call. Without this rule, a read could look like a success
against old data.

An image is one of two forms:

- a `.prg`: a 2-byte little-endian load address, then the payload.
- a flat capture with the extension `.raw` or `.bin`, exactly 65536 bytes.

The verbs dispatch by extension first, and by length second. A short `.raw` is
refused with `a flat 64K capture must be exactly 65536 bytes`. The verb does not
read it as a `.prg`. If you get this refusal, the capture is too short. Capture
it again. Do not rename it.

`anno_get_binary_info` reports the origin, the byte lengths and the payload
entropy. An entropy of 7.5 or more is a sign of a packed image. `c64-unpacker`
gives the verdict and tells how to depack.

### One writer at a time

The project is one SQLite file, and SQLite lets one writer hold it at a time.
Every write commits and syncs to disk before the call returns. Thus several
parallel writers give no more throughput.

Every write accepts an optional `base_revision` (compare-and-swap). If the
project moved past that revision, the store refuses the write with
`AnnoStoreStaleRevisionError`. It writes nothing. Read the current revision
with `anno_save_project`. That call writes nothing. It only reports the revision.

## Write findings

| Call | Use it to |
|---|---|
| `anno_set_label_name` | Name a routine, table or variable (`init_screen`, `sprite_table`) |
| `anno_set_comment` | Record the evidence, as a `line` or `side` comment |
| `anno_set_data_type` | Type an inclusive range (`code`, `byte`, `petscii`, …) |
| `anno_add_scope` / `anno_remove_scope` | Mark or remove a routine's extent as a lexical scope |
| `anno_batch_execute` | Send 5 or more independent writes as one transaction |

Each write that you repeat with the same values succeeds and reports
`changed: false`. Thus you can run an annotation pass again.

**Labels.** A name must be a legal ACME identifier: a letter or an underscore,
then letters, digits or underscores. It must not be a 6502/6510 mnemonic. The
call rejects an illegal name. It never changes the name to make it legal. It
also refuses a name that another address already holds. The `kind` is `User`
when you omit it.

Do not start a name that you choose with an auto-name prefix: `zpf_`, `f_`,
`zpa_`, `a_`, `p_`, `zpp_`, `e_`, `j_`, `s_`, `b_` or `r_`. The reports also
count `l_XXXX`, `FUN_XXXX`, `LAB_XXXX`, `lXXX` and `lXXXX` as auto-names. The
reports count each such label as not yet named.

**Comments.** A `line` comment is on its own line before the instruction. A
`side` comment is on the same line. One address can hold one of each. A new
comment replaces the old comment in the same placement. Do not start the text
with `;`, because the exporter adds it. The call refuses text that is too long.
It measures the limit in UTF-8 bytes. It does not truncate the text.

**Data types.** The twelve types are in [`references/tools.md`](references/tools.md#the-twelve-data-types).
A write keeps what the overlapping rows say about the addresses outside its range.
Adjacent ranges of the same type stay two rows. A range that spans several rows
becomes one row. To change a wrong type, set the correct type on the same
range. No undo call is necessary.

A successful `anno_set_data_type` can report two disclosures. Read them. They
are not errors.

- `contradictedComments` names each comment whose confidence grade now
  contradicts the new type.
- `reinterpretedSplitTables` names each split table that the write cut into
  parts. It gives the address pairs before and after. A part of a split table
  pairs its bytes differently, so its entries decode to different addresses.

A split type refuses an odd byte count. The low half and the high half must
have the same length.

**Scopes.** The call refuses a nested or overlapping scope, and names both
spans. Two scopes that only touch at a boundary are both accepted.
`anno_remove_scope` needs the exact stored span. If one end of a scope is
wrong (for example `$1000..$ffff`), the store refuses every later scope above `$1000`.
Remove the wrong scope with `anno_remove_scope`. The project keeps no history.

**Batches.** Name the image one time, at the top level of the batch. Every
inner call gets it, also through nested batches. A batch runs in two phases:

1. The batch reads the whole payload first. If one entry is bad, it refuses
   the WHOLE batch by index and runs nothing. Examples: an empty `calls` array, an
   unknown name, an illegal label, or a range above the read cap.
2. Then it runs every entry to the end, and records a status for each one.

Thus `isError: true` means "do not send this batch". An error entry in a
successful result means that one call failed. The call refuses a nesting depth above 4.

```json
{"image":"game.prg","calls":[
  {"name":"anno_set_data_type","arguments":{"start_address":"$0900","end_address":"$093f","data_type":"byte"}},
  {"name":"anno_set_data_type","arguments":{"start_address":"$0940","end_address":"$097f","data_type":"petscii"}},
  {"name":"anno_set_label_name","arguments":{"address":"$0940","name":"msg_game_over"}}
]}
```

### Confidence prefixes

Start every evidence comment with exactly one of these five tokens:

| Token | Grade | Means |
|---|---|---|
| `[confirmed-code]` | confirmed code | Executed during tracing, PC observed inside it |
| `[probable-code]` | probable code | Reachable through a `JSR`/`JMP`/vector, not yet observed executing |
| `[confirmed-data]` | confirmed data | Never hit as an instruction stream across full gameplay coverage |
| `[probable-data]` | probable data | Indexed-load target, or matches a data shape (sprite blocks, PETSCII, address tables) |
| `[unknown]` | unknown | No reliable interpretation yet |

The "Means" column is the literal text in `src/mcp/vice/anno-confidence.mts`.
Do not reword it.

A comment with no leading bracket is a legal comment without a grade. The store refuses a
bracket token with a typo. Examples: a wrong case, an underscore, a plural,
or a space inside the brackets. The refusal reads
`"[<token>]" is not a valid confidence grade`. Thus an `[unknown]` row cannot
disappear from the query below.

To change a grade, send a new `anno_set_comment` with the new evidence. Do not
edit the grade token only. The new evidence records why the grade changed.

**Two more comment prefixes are part of the completeness gate:**

- `DECLINED: <what is unknown and why>` records a referenced address whose
  target you cannot find. The gate counts it as resolved. Write this, not an
  invented name.
- `DISAGREEMENT-ACCEPTED: <why>` records a reviewed disagreement between the
  block table and the runtime evidence. The gate counts it as resolved.

## Read back annotations

Every list call needs `max_results`. It has no default. The answer gives the
true match count next to the list, so the answer tells you about truncation.

| Call | Answers | Needs `image` |
|---|---|---|
| `anno_get_symbols` | Labels, optionally in an address window | no |
| `anno_get_comments` | Comments, filtered by addresses, window or placement | no |
| `anno_get_blocks` | Typed ranges. `include` adds `scopes`, `enums`, `enum_usage` | no |
| `anno_get_cross_references` | Every address that references the address you name | yes |
| `anno_search` | A substring in labels, comments and `code` instruction text | yes |
| `anno_get_address_details` | Labels, comments, covering range and cross-references at ONE address | yes |
| `anno_read_region` | One explicit range, as `disasm` (default) or `hexdump` | yes |
| `anno_disassemble` | ACME `!cpu 6510` source from an explicit start address | yes |

`anno_get_cross_references` makes its answer again on each call, from three
sources. It never caches the result.

1. The instructions in every range of type `code`.
2. The split ADDRESS tables. The `_address` types give cross-references, and the
   `_word` types do not.
3. The stored rows. Only a computed dispatch or an asserted edge needs a stored
   row, because the bytes cannot show it.

`anno_search` matches byte-exact and case-sensitive in all three corpora. The
answer names each corpus and its entry count. Thus a zero over a real corpus is
different from a missing corpus. To list what is still unknown:

```bash
$A call anno_search --args '{"image":"game.prg","query":"[unknown]","max_results":2000}'
```

Set `max_results` above the comment count of the program.

`anno_get_address_details` shows that the client made the answer from parts.
The body carries `composed_client_side` and a `composed_from` list of the four
sources. A part with no answer comes back as `{available:false, reason}`.

### The 4096-byte read cap

`anno_read_region` and `anno_disassemble` share one cap: **4096 bytes** for each
call (`ANNO_READ_REGION_MAX_BYTES`). The call refuses a wider request with
`AnnoRegionRangeError`, and the message names the cap and the width. The call
never truncates. To read a large binary, read consecutive ranges. For careful
classification, read 256 to 512 bytes at a time.

Both calls decode the image bytes again on each call, and they write nothing.
Thus reading a range does not classify it. Record the range that you examined
with `anno_set_data_type`. An opcode that ACME cannot express comes out as `!byte`,
with the mnemonic in a comment.

To read the RAM of a running machine, use `c64-emulator`.

## Import analyser output

`c64-disassembler` runs Ghidra and writes a transfer file. Two mechanical calls
put its findings into the project. Run them in this order:

1. **`anno_import_ghidra_export`** reads the file at `export_path`. It writes one
   cross-reference row for each reference. It removes the transfer file after
   every write commits. It reports:
   - `referencesSeen`
   - `xrefsWritten`
   - `xrefsAlreadyPresent` (it writes a duplicate reference only one time)
   - `kindsSeenNotImported` (reference kinds outside the four kinds that the
     project stores. It counts them and drops them.)
   - `constWrites`: the recovered constant stores to `$01`, `$D011`, `$D018` and
     `$DD00`.

   **Keep `constWrites`.** The call removes the transfer file, so this answer is the
   only copy. The call refuses a malformed, truncated or digest-mismatched file,
   and names the section and the line. On a refusal it writes and removes nothing.
   `sha256` is optional. When you give it, a digest mismatch refuses the call.
2. **`anno_join_memmap`** reads every cross-reference target in the project. It
   skips the addresses inside the loaded image. It writes a comment with the
   narrowest `c64-memory-map/memmap.json` entry at each other address. It reports:
   - `addressesConsidered`, `annotated`, `skippedInImage`, `skippedNoMapEntry`,
     `skippedExistingComment`, `declined`, `commentsChanged`
   - a decision for each address, with the reason for each skip. The outcome
     `skipped-existing-comment` means the address already has a human line
     comment. The join never overwrites a human line comment.

   Give the SAME `constWrites` array, unchanged, as `const_writes`. It starts two
   more steps:
   - Bank-state resolution. An address that depends on `$01` declines with a
     reason when the `$01` value is absent or disagrees.
   - Graphics ranges derived from the VIC registers, written back to the project.
     If there is more than one combination, `graphics_map_index` selects one
     (default 0). An index out of range refuses the call.

   If you omit `const_writes`, neither step runs.

Run the import one time for each export. Run the join one time for each
updated image. Run the join again on an unchanged project, and it reports
`commentsChanged: 0`. The import writes cross-reference rows only.
It writes no names.

## Enums

An enum makes an immediate operand read as a name, not as hex.

```bash
$A call anno_create_project_enum --args '{"name":"game_state","variants":{"0":"INIT","1":"TITLE","2":"PLAY"},"description":"main state machine"}'
$A call anno_apply_enum_usage --args '{"address":"$1234","name":"game_state"}'
$A call anno_update_project_enum --args '{"name":"game_state","variants":{"0":"INIT","1":"TITLE","2":"PLAY","3":"OVER"}}'
```

- **Create.** Variant keys are numeric strings: decimal, `0x`/`$` hex or `0b`/`%`
  binary. The call refuses two keys for the same number. It refuses a name that
  exists with different contents. Use update for that.
- **Apply.** Bind the enum to the address of the instruction that holds the
  immediate operand (the `lda`, not the `sta`). One address holds at most one
  enum. A new enum replaces the old one. If you omit `name` or give `""`, the
  call removes the binding. The call refuses an enum that does not exist. It
  does not create it.
- **Update.** `anno_update_project_enum` changes the name (`new_name`), the
  variants or the description. When you give `variants`, it REPLACES the whole
  mapping. It does not merge. Thus you can remove a variant. The call refuses a rename
  onto a name that another enum holds. A rename keeps every usage, because usages
  refer to the enum id. The call refuses an update of a missing enum.

`anno_get_blocks` with `include: ["enums","enum_usage"]` reads all enums and
bindings back.

**Register enums.** Give the enum the four upper-case hex digits of the register,
for example `D018`. The bit-name table `src/mcp/vice/anno-regbits.json` covers
`$0001`, `$D011`, `$D015`-`$D01D`, the SID voice and filter control registers,
and the CIA port, interrupt and control registers.
If the table holds the register, a bound write shows as OR-ed field names. It
also gets a comment that decodes each field, as in
`#D018_SELECT..0 | D018_CHARACTER..2 | D018_VIDEO..0`. For a register with a
single field, and for any other enum, the operand shows as `<enum>_<VARIANT>`.
In that case the operand value needs a variant, or the render fails.
`anno_disassemble` and `export-asm` render bound writes the same way.

No verb generates enums from the register writes of a program. Create and apply
each enum with the calls above. `c64-memory-map` describes the bit table.

## Mark a range as excluded

The operator can ask to leave a range out of a rebuild:

```bash
$A call anno_exclude_range --args '{"start_address":"$1000","end_address":"$10ff","reason":"trainer patch"}'
$A call anno_include_range --args '{"start_address":"$1000","end_address":"$10ff"}'
```

**An exclusion removes no bytes.** The export still writes every byte of the
range, with a visible marker that gives the reason. `reason` is necessary and
must not be empty. The call refuses an overlapping span. It also refuses the
same span with a different reason. `anno_include_range` needs the exact stored
span. The tool never excludes a range by itself. The operator decides.
`c64-provenance` supplies the verdicts that the operator reads.

## Render the memory map

Do not write the memory map by hand. Fill in the provenance sidecar
([`templates/memory-map.template.md`](templates/memory-map.template.md) has the
schema and an example). Then run:

```bash
$A render-memmap --provenance sidecar.json --out memory-map.md
$A render-memmap --provenance sidecar.json --out memory-map.md --check
```

- `--out` is necessary. The verb replaces an existing file only with `--force`.
- The verb takes no positional argument. It renders the workspace project.
- It needs an existing project and an existing sidecar. It creates neither of them.
- It prints the row count, the number of `[unknown]` rows and the render digest.

`--check` renders again and compares with the file at `--out`. It prints
`in sync` and exits 0, or it prints the first different line and exits
non-zero. It prints `missing` when the file does not exist. `--check` reports
drift only when one of these changed:

- the rendered file (a hand edit)
- a project row: a range, a label, a comment, or a confidence grade
- the bytes of the sidecar
- the location of the sidecar relative to the workspace root
- the renderer

A move of the checkout to a different absolute path is not drift. The banner
records only the relative location of the sidecar. To remove drift, run the
verb again. Do not edit the rendered file, and do not remove its banner.

## Export annotated assembly

```bash
$A export-asm game.prg --out game-src
$A export-asm game.prg --out game-src --ledger recovery/PROVENANCE.md
```

The image supplies the bytes. The project supplies names, ranges, comments,
scopes and enums. `--out` is a necessary DIRECTORY:

- `root.a` is the entry point. It sources `symbols.a` first, then one file for
  each scope, then `unscoped.a` for blocks outside all scopes.
- A project with no scopes gets the same three files.
- The verb refuses a directory that is not empty. With `--force` it replaces
  only the file names that it writes. It refuses any other entry by name.
- `--out` must not be or contain the image, the ledger or
  `.c64-re-tools/annotations.db`. `--force` does not change this.

**The verb writes source and runs no assembler.** Its second output line says:

```
export-asm: this file has NOT been assembled -- this command writes source text and runs no assembler.
```

A real-ACME byte-diff test in this repository's own test suite proves that the
output reassembles. The published package does not contain that test. Thus a
clean run shows only that the verb wrote the source. To assemble the tree, use
`c64-assembler`.

The verb refuses, with exit 1, an annotation that it cannot express. Examples:
a range that the image does not cover, an enum on an operand that cannot carry
it, or a comment with no line. It never drops such an annotation silently.

**`--ledger`** reads the `recovery/PROVENANCE.md` that `c64-provenance` writes.
It adds the Verdict and Confidence of each covered range as a comment on the
overlapping block. It changes only comment text. It never changes which bytes
or blocks the verb writes. It refuses by name a range that the ledger does not
cover. Without `--ledger`, the export has no provenance comments.

The project has no export to a VICE label file. When you find a name on the
running machine, write it into the project first with `anno_set_label_name`.

## Measure completeness

These reports read the project. They write nothing. None of them prints a
percentage or a single combined figure, because one aggregate can hide a weak
measure behind a strong one.

### `anno coverage`

```bash
$A coverage game.prg --out coverage.json    # --force to replace, --sample N for a larger sample
```

The image supplies the payload and the origin. The report prints separate
measures, each under its own heading:

- **The byte census and the unreached count.** The census walks from each seed.
  The unreached count is the bytes that the walk never reached.
- **The two label figures,** including the fraction of user-chosen names.
- **The reproducibility sample.**
- **The comment-vacuity measure.** One sentence on fifty addresses counts one time.
- **The indirect-dispatch scan.**
- **The divergence sub-report.** It lists bytes that the census reached as
  instructions but the project does not type as `code`, and the reverse.

Read the measures together. Do not quote one alone:

- A high user fraction with a large unreached count means that names cover
  only the visible part of the program.
- A large divergence means that the project and the bytes disagree about which
  bytes are code. Bytes typed `code` that the census never reached are normal
  on an image with filler.
- A low distinct-comment ratio means that the comments are filler.

The verb exits 0 when the numbers are bad. A low measure is a result. It exits
non-zero for a caller error, a path outside the workspace, an image with a
payload that it cannot decode, or a project or report that it cannot read or write.
A non-`.prg` file of exactly 65536 bytes also reads as a flat capture here. A
retired JSON project file still reads, but no tool writes one now.

### Runtime evidence

These calls compare the typed ranges with what the emulator executed:

| Call | Does |
|---|---|
| `anno_evid_ingest` | Stores the execute bits from one raw `memmapshow` reply, for one run identity (`image_sha256`, exact `argv`, `seed`) |
| `anno_evid_runs` | Lists each run identity with its observation count and denominator |
| `anno_evid_reset` | Removes the rows of ONE run identity. It touches no other rows |
| `anno_evid_disagreements` | Joins the block table with the evidence. Disagreements come first |

`c64-emulator` gets the `memmapshow` reply (`vice_memmap_show`) and clears the
emulator's access map (`vice_memmap_zap`). To measure a run again from zero, do
both `vice_memmap_zap` and `anno_evid_reset`.

The CLI verb prints the same join as `anno_evid_disagreements`:

```bash
$A evid-disagreements [--run IMAGE_SHA256:ARGV_DIGEST:SEED] --json > game-disagreements.json
```

`--run` selects the recorded run to answer for. `anno call anno_evid_runs`
lists the runs. A project with one run needs no `--run`. A project with
several runs refuses the verb without `--run`, because a mix of runs answers
for none of them.

It prints disagreements as rows. It prints agreement as one count. An address
that the block table covers but that no run executed is its own count. **That
count is not evidence of data.** A missing observation proves nothing. Two more
counts show evidence at addresses outside any block and at `undefined` blocks.

### `anno hazard-report`

```bash
$A hazard-report --image game.prg [--json]
```

It lists what prevents moving, relocating, rebasing or stripping code, from the
decoded bytes only. For example, a store can write onto the opcode or operand
of another instruction. Each finding has its detection mechanism and a strength
token: `observed-corroborated`, `static-shape-matched` or `static-signature-only`.
These are not the five confidence grades.

Each region gets one of three outcomes: `hazard-reported`, `no-signal` or
`unclassified`. **None of the three outcomes means "safe to move".** A store through a pointer
that the program calculates at runtime is a known, named miss. The report never
moves anything. A human decides.

### `anno decomp-completeness` and the gate

```bash
$A decomp-completeness --fixture <dir>/<fixture>.prg --disagreements <fixture>-disagreements.json --manifest test/vice/fixtures/decomp-execution-manifest.json
node skills/c64-annotations/scripts/completeness-report.ts --fixture <dir>/<fixture>.prg --disagreements <fixture>-disagreements.json --manifest test/vice/fixtures/decomp-execution-manifest.json
```

Run both from the workspace whose project holds the fixture's annotations.
Each of the three arguments is necessary. None has a default.

- `--fixture` is the fixture as its manifest entry spells it (path or stem).
- `--disagreements` is the JSON that `anno evid-disagreements --json` wrote for
  this project. If the project holds several runs, run `evid-disagreements`
  with `--run` first. The verb refuses a document with a missing field. It also
  refuses a document whose run identity is not in the project's evidence runs.
- `--manifest` records which fixtures ran under the reproducible-run protocol.
  The verb refuses a manifest that does not list the fixture.

An omitted query and a query that found nothing must never give the same report.

`completeness-report.ts` renders the verb's `--json` answer. **Its exit code
is the gate.** It exits 0 only when all six conditions pass:

1. The answer has a byte census with an `undefinedCount`, and the verb found
   the fixture's image (`imageUnavailable` is not `true`). A missing census,
   or an unavailable image, fails the gate.
2. The project has no `undefined` byte.
3. No `code` range holds an auto-named label.
4. Each entry point has a name that is not an auto-name, and a comment with all four of
   `function:`, `inputs:`, `outputs:` and `side effects:` (any case).
5. Each referenced non-hardware address has a name or a `DECLINED:` comment.
6. Each disagreement has a `DISAGREEMENT-ACCEPTED:` comment.

A non-zero exit names each failed measure and its address. The last stdout
line is one JSON result: `{"ok":true,"gate":"PASS"}`, or `{"ok":false,
"message":"GATE: FAIL (<n>)","failures":[…]}`. The script refuses a
disagreement census that has more unresolved entries than rows. Read the exit
code or that line, not the rendered text.

## Failure shape

`anno call` prints the answer JSON and exits 0, or prints
`[<ErrorClass>] <name> refused|failed: <message>` on stderr and exits 1. The report verbs exit
non-zero for a caller error, and print the reason. `completeness-report.ts` exits 1 when
it cannot get the report, or when one gate condition fails. It prints the reason.

## What this skill does NOT do

- **Method.** The order of a recon, the proof that a range is code, and the
  naming conventions are in `c64-reverse-engineering`.
- **Disassembling with Ghidra or dxa.** `c64-disassembler` writes the export
  that this skill imports.
- **Running the emulator.** `c64-emulator` reads live RAM and loads labels into VICE.
- **Assembling the export.** `c64-assembler` runs ACME.
- **What an address means.** `c64-memory-map` looks up addresses and owns `memmap.json`.
- **Provenance verdicts.** `c64-provenance` writes the ledger.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `this workspace has no annotation project yet` | No call wrote to the project yet. Do a write first, or make sure that the workspace root is the correct project. |
| `refused: "store" is not an argument` | Remove `store`. Every call uses the workspace project. |
| `call: unknown anno tool "<name>"` | The message lists the accepted names. Compare the spelling with `references/tools.md`. |
| `anno: unknown verb "<verb>"` | Use one of the nine verbs that the CLI lists. |
| `"max_results" must be a positive integer` | Give `max_results`. It has no default. |
| `[AnnoRegionRangeError]` | The range is above 4096 bytes. Read consecutive ranges. |
| `a flat 64K capture must be exactly 65536 bytes` | The capture is too short. Capture it again. |
| `is not a legal ACME identifier` | Choose a different name. The call never changes a name. |
| `is not a valid confidence grade` | Use one of the five tokens exactly. |
| `[AnnoStoreStaleRevisionError]` | Another write moved the project. Read it again, calculate the edit again, and send it again. |
| `render-memmap: takes no positional argument` | Remove the positional. The verb renders the workspace project. |
| `call: --args did not parse as JSON` | Correct the JSON. For a large object, use `--args-file`. |
