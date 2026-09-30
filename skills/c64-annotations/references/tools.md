# The `anno_*` calls and their arguments

Run each call with `anno call <name> --args '<json>'`. `../SKILL.md` gives the
three install forms of the command.

The source of these definitions is `src/mcp/vice/anno-tool-defs.mts`. The
`call` verb refuses a name that is not in the list below.

## Argument rules for all calls

- **Address:** an integer 0..65535, a `"$hex"` string or a `"0x"` string. The
  call refuses an unprefixed numeric string.
- **Range:** `start_address` and `end_address` are both INCLUSIVE. A one-byte
  range has `end_address` equal to `start_address`.
- **`image`:** a path to a `.prg`, or to a `.raw`/`.bin` flat capture of exactly
  65536 bytes. The client reads the file and sends its bytes.
- **`base_revision`:** optional on every write. It is an integer. The call
  refuses a numeric STRING, for example `"0001"`.
- **`max_results`:** a positive integer. "Yes" in the table means that the call
  needs it and has no default.
- **No `store`:** no call takes a `store` argument.

## Write calls

| Call | Arguments (necessary in **bold**) | Notes |
|---|---|---|
| `anno_set_label_name` | **`address`**, **`name`**, `kind` (`User` default, `Auto`, `System`, `Platform`), `base_revision` | Refuses an illegal ACME identifier, a mnemonic, or a name that another address holds |
| `anno_set_comment` | **`address`**, **`comment`**, **`type`** (`line` or `side`), `base_revision` | No leading `;`. The limit is in UTF-8 bytes |
| `anno_set_data_type` | **`start_address`**, **`end_address`**, **`data_type`**, `base_revision` | Reports `contradictedComments` and `reinterpretedSplitTables` |
| `anno_add_scope` | **`start_address`**, **`end_address`**, `base_revision` | Refuses a nested or overlapping scope |
| `anno_remove_scope` | **`start_address`**, **`end_address`**, `base_revision` | Needs the exact stored span |
| `anno_exclude_range` | **`start_address`**, **`end_address`**, **`reason`**, `base_revision` | Removes no bytes from the export. Refuses an overlap |
| `anno_include_range` | **`start_address`**, **`end_address`**, `base_revision` | Needs the exact stored span. Its success body lists `excludedRanges` |
| `anno_create_project_enum` | **`name`**, **`variants`**, `description`, `base_revision` | Keys are decimal, `0x`/`$` hex or `0b`/`%` binary |
| `anno_update_project_enum` | **`name`**, `new_name`, `variants`, `description`, `base_revision` | `variants` replaces the whole mapping |
| `anno_apply_enum_usage` | **`address`**, `name`, `base_revision` | An omitted or empty `name` removes the binding |
| `anno_batch_execute` | **`calls`** (array of `{name, arguments}`), `image` | Inner calls get `image` from the top level. Maximum depth 4 |
| `anno_import_ghidra_export` | **`export_path`**, `sha256`, `base_revision` | Removes the transfer file on success. Returns `constWrites` |
| `anno_join_memmap` | **`image`**, `const_writes`, `graphics_map_index`, `base_revision` | `const_writes` items are `{store_address, target_address, value}` |
| `anno_evid_ingest` | **`memmap_text`**, **`image_sha256`**, **`argv`**, **`seed`**, `base_revision` | Writes a row only for an observed execute bit |
| `anno_evid_reset` | **`image_sha256`**, **`argv`**, **`seed`**, `base_revision` | Removes the rows of one run identity only |

A write that you repeat with the same values succeeds and reports
`changed: false`.

## Read calls

| Call | Arguments (necessary in **bold**) | `max_results` | Notes |
|---|---|---|---|
| `anno_save_project` | none | — | Reports the revision. Writes nothing |
| `anno_get_symbols` | **`max_results`**, `start_address`, `end_address` | yes | Labels in insertion order |
| `anno_get_comments` | **`max_results`**, `addresses`, `start_address`, `end_address`, `type` | yes | The filters combine with AND |
| `anno_get_blocks` | **`max_results`**, `block_type`, `include` (`scopes`, `enums`, `enum_usage`) | yes | `max_results` bounds the range list only |
| `anno_get_binary_info` | **`image`** | — | Origin, lengths, payload entropy. Above 7.5 means probably packed |
| `anno_read_region` | **`image`**, **`start_address`**, **`end_address`**, `view` (`disasm` default, `hexdump`) | — | 4096-byte cap |
| `anno_disassemble` | **`image`**, **`address`**, `end_address` | — | Same 4096-byte cap. Without `end_address` it decodes up to the cap or the image end |
| `anno_get_cross_references` | **`image`**, **`address`**, **`max_results`** | yes | Calculated again on each call. Never cached |
| `anno_search` | **`image`**, **`query`**, **`max_results`**, `search_labels`, `search_comments`, `search_instructions` | yes | Byte-exact, case-sensitive. The three corpora are on by default |
| `anno_get_address_details` | **`image`**, **`address`** | — | Discloses `composed_client_side` and `composed_from` |
| `anno_evid_runs` | none | — | Each run identity with its count and denominator |
| `anno_evid_disagreements` | `max_results`, `image_sha256`, `argv_digest`, `seed` | optional | Give all three identity fields or none |
| `anno_hazard_report` | **`image`**, `max_results` | optional | Opens the store read-only |

Details of some read calls:

- `anno_search` refuses an empty `query`. A request for a corpus that the call
  does not have gets `{available:false, reason}` in a successful body.
  `search_instructions` is the slow corpus, because it decodes every code range.
- `anno_get_blocks` returns the `include` collections whole. `max_results` does
  not limit them.
- `anno_evid_disagreements` takes `argv_digest` as `anno_evid_runs` reported it.
  `anno_evid_ingest` and `anno_evid_reset` take the exact `argv` and calculate
  the digest themselves. They never accept a digest, so a caller cannot invent a
  run identity.

## The twelve data types

| `data_type` | Use it for |
|---|---|
| `code` | 6502/6510 instructions that you proved execute |
| `byte` | Raw 8-bit data: sprites, bitmaps, charsets, lookup tables, variables, unknowns |
| `word` | 16-bit little-endian values: variables, constants, SID frequencies |
| `address` | 16-bit little-endian pointers: jump tables, vector lists. Gives cross-references |
| `petscii` | PETSCII text, for example strings sent to `$FFD2` |
| `screencode` | Screen-code text that the program writes to screen RAM |
| `lo_hi_address` | Split address table, low bytes first. Even byte count. Gives cross-references |
| `hi_lo_address` | Split address table, high bytes first. Even byte count. Gives cross-references |
| `lo_hi_word` | Split word table, low half first, for example a SID frequency table. Even byte count |
| `hi_lo_word` | Split word table, high half first. Even byte count |
| `external_file` | A large blob to export as it is: a SID tune, a bitmap, a charset |
| `undefined` | Sets the range back to unknown |

`c64-reverse-engineering` tells how to decide which type a region has.
