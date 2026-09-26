# Shared Argument Parsers

Parse cross-cutting arguments through one seam only:

| Argument | Use | Module |
|---|---|---|
| address | `parseAddress(v)` | stock-address.ts |
| byte count | `parseByteCount(v, { max })` | stock-address.ts |
| optional bank | `resolveBank(tool, v, session)` | stock-memory.ts |
| required bank | `resolveRequiredBank(tool, name, session)` | stock-memory.ts |

- Never write an address regex or a 0..$FFFF range check in a handler.
- A bare decimal string is decimal here. Hex needs `$` or `0x`. (The
  checkpoint-condition emitter has its own hex-default lexer. Don't mix
  the two.)
- Chip-state reads (VIC-II, CIA, sprites) use `resolveRequiredBank()`,
  never bank 0. The CPU view returns RAM under $D000-$DFFF when the
  program banks I/O out via $01.
