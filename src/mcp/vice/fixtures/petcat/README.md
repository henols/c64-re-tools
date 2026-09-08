# fixtures/petcat — provenance

## `computed-sys.bas` / `computed-sys.prg` (26 bytes, 40-03, D-23)

The computed-`SYS` counterpart to the already-committed literal-`SYS` fixture
(`fixtures/dxa/basic-stub.prg`, `10 SYS 2064`) — CONTEXT.md's own worked
example: a BASIC line whose `SYS` argument reads the BASIC-start pointer
bytes at `43`/`44` and combines them, rather than naming a fixed decimal
address. Authored, not found (D-23): built directly with `petcat` itself,
which is the simplest authoring tool for this shape — no `acme.build` seam
call and no hand-assembled tokenized bytes needed, since `petcat -w2` IS the
tokenizer.

**Keyword-case hazard (Pitfall 5):** the source line MUST use lowercase BASIC
keywords (`sys`, `peek`). `petcat`'s tokenizer only recognises lowercase
keyword text as tokens to convert — an uppercase `SYS`/`PEEK` in the source
would be treated as literal ASCII and silently produce a NON-tokenized
program that looks plausible but round-trips to garbage. `computed-sys.bas`
is committed lowercase for exactly this reason.

**Exact command, run on this host, 2026-09-08:**

```
$ printf '10 sys peek(43)+256*peek(44)\n' > computed-sys.bas
$ petcat -w2 -o computed-sys.prg -- computed-sys.bas
```

`petcat --version`'s banner names the build: `petcat (VICE 3.10) -- Basic
list/crunch utility.` (`/usr/local/bin/petcat`, the fork build resolved
first on this host's `$PATH` — the same binary `findSiblingBinary()`
(`host-tool.mts`) resolves at request time, since it walks from whichever
`x64sc` `backend-detect.mts` already resolved, which on this host is also
`/usr/local/bin/x64sc`).

**Byte layout** (little-endian load address first):

| Offset | Bytes | Meaning |
|---|---|---|
| `$0000-$0001` | `01 08` | load address `$0801` |
| `$0002-$0003` | `17 08` | next-line pointer |
| `$0004-$0005` | `0a 00` | BASIC line number `10` |
| `$0006` | `9e` | `SYS` token |
| `$0007` | `20` | space (ASCII) |
| `$0008` | `c2` | `PEEK` token |
| `$0009` | `28` | `(` (ASCII) |
| `$000a-$000b` | `34 33` | ASCII `"43"` |
| `$000c` | `29` | `)` (ASCII) |
| `$000d` | `aa` | `+` token |
| `$000e-$0010` | `32 35 36` | ASCII `"256"` |
| `$0011` | `ac` | `*` token |
| `$0012` | `c2` | `PEEK` token |
| `$0013` | `28` | `(` (ASCII) |
| `$0014-$0015` | `34 34` | ASCII `"44"` |
| `$0016` | `29` | `)` (ASCII) |
| `$0017` | `00` | end of line |
| `$0018-$0019` | `00 00` | end of program |

Total: 26 bytes.

**Round-trip verification** (proves the keywords tokenized rather than
landing as literal text — a non-tokenized fixture would echo back the raw
ASCII bytes, not a decoded `sys`/`peek` line):

```
$ petcat -2 computed-sys.prg
;computed-sys.prg ==0801==
   10 sys peek(43)+256*peek(44)
```

The decoded line is byte-for-byte the source line — the tell a keyword-case
mistake would fail is a round-trip that does NOT echo verbatim (garbled
PETSCII, or the raw ASCII text unchanged).

**Per-file sha256:**

| File | sha256 |
|---|---|
| `computed-sys.bas` | `ccd2ae663cab5ad0d4827ce89d3655385ba19c73622a1a1fc9d2f6c4a6046d0d` |
| `computed-sys.prg` | `7270ca676faa6fcce0f54a95c85be15ad5861f2daccf66d0368d603a84b6d34e` |

## What NOT to do

**Never hand-edit the tokenized bytes.** Regenerate `computed-sys.prg` from
`computed-sys.bas` with `petcat -w2` if either file is ever regenerated — a
hand-assembled fixture can disagree with what `petcat`'s own decoder
(`petcat -2`) will produce, which is exactly the failure mode this fixture
exists to avoid for the tool under test.

## The literal-`SYS` counterpart

`fixtures/dxa/basic-stub.prg` (18 bytes, sha256
`01b9dc6965426b4940262db29f489105d23e58933695a4e451eb5f1a30ebbde8`) already
covers the literal fast path — `petcat -2` on it decodes to `10 sys2064`,
confirmed working during this project's own Phase 40 discussion and
re-confirmed live this session. `petcat.decode`'s three-branch handover
verdict (`host-tool.mts`) is tested against both fixtures: the literal one
resolves to a numeric entry point (`2064`), and this one declines by name,
quoting the unresolved expression.

## `not-basic.prg` (64 bytes, 40-04, D-12)

The planted-failure fixture for `PREP-04`'s `petcat.decode` non-vacuous
control (`host-tool-oracle.test.ts`). 64 deterministic non-BASIC bytes
(never random output, so the committed digest is stable) — byte `i` is
`(i*7+3) mod 256`:

```
$ python3 -c "open('not-basic.prg','wb').write(bytes([(i*7+3)%256 for i in range(64)]))"
```

sha256: `39e3d7b6b5d075d37d053ad89b24b41bef4f3c29760c84447cab3f3be1882241`

**MEASURED live 2026-09-08** (`/usr/local/bin/petcat`, VICE 3.10, and
independently re-confirmed against `/usr/bin/petcat` VICE 3.9 stock — both
builds agree): `petcat -2 not-basic.prg` prints a banner line **without**
the `==<hex>==` address form (`;not-basic.prg {stop}{$0a}{down}...`, PETSCII
control-code noise, never a recognised BASIC line) and **exits 0** — this
IS the planted-failure input `classifyPetcatDecodeOutput()` must refuse
while a naive exit-status check would (wrongly) pass it, precisely the
non-vacuous control D-12 requires. Do NOT use a nonexistent path instead:
it exits 1, on which the exit-status-only predicate would ALSO refuse,
making the control vacuous. Do NOT use a zero-byte file: it produces a
well-formed banner the shape oracle accepts (the `PREP-04` empty-input
edge, covered separately by the handover verdict's no-handover-instruction
branch, not by this fixture).
