# Phase 30: ACME Export and the Real-ACME Oracle - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 9 new/modified (2 new modules, 2 new test files, 1 modified CLI + 2 modified guard tests, 1 fixtures dir, 1 modified `package.json`)
**Analogs found:** 9 / 9 (every new file has a real in-tree analog; no file falls back to RESEARCH.md-only patterns)

**Scope, binding (user decision this session):** Oracle + `export-asm` only. `gen-enums`,
`export-lbl` and `import-lbl` are **out of scope** despite `anno-cli.ts:24` and
`scripts/lib/anno-cli-verbs.mjs` saying they "return in Phase 30" — no analog is mapped for
them. The ACME verify module is **test-only**, mirroring `acme-gate.ts`; it does NOT join
`package.json`'s `files[]`. The exporter DOES ship.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/mcp/vice/anno-export-asm.ts` (NEW, **ships**) | service / renderer | transform (store rows → text) | `src/mcp/vice/anno-memmap-render.ts` (structure) + `src/mcp/vice/disasm-renderer.ts` (ACME emission) | exact (two-analog split) |
| `src/mcp/vice/acme-verify.ts` (NEW, **test-only**) | utility / external-process oracle | request-response (spawn → verdict) | `src/mcp/vice/acme-gate.ts` (test-only posture, `ACME_BIN`, spawn rule) + `disasm-roundtrip.test.ts`'s `assemble()` (the spawn shape) | exact |
| `src/mcp/vice/anno-cli.ts` — new `export-asm` verb (MODIFIED) | controller | request-response (argv → exit code) | `cmdRenderMemmap()` in the same file | exact (same file, same verb shape) |
| `src/mcp/vice/anno-export-asm.test.ts` (NEW) | test | integration + structural | `src/mcp/vice/disasm-roundtrip.test.ts` | exact |
| `src/mcp/vice/acme-verify.test.ts` (NEW) | test | integration (child process) | `src/mcp/vice/acme-gate.test.ts` | exact |
| `.planning/phases/30-.../fixtures/README.md` + 2 transcripts (NEW) | fixture/provenance doc | file-I/O | `.planning/phases/29-the-mcp-surface/fixtures/README.md` + `src/mcp/vice/fixtures/backend-detect/README.md` | exact |
| `src/mcp/vice/anno-cli-path-consumers.test.ts` (MODIFIED — inventory + floor) | test | structural inventory | itself (append rows, raise `CLI_PATH_ARGUMENT_FLOOR`) | exact |
| `src/mcp/vice/anno-verb-coverage.test.ts` (MODIFIED — `ANNO_CLI_VERB_FLOOR` 2→3) | test | structural floor | itself, line 178 | exact |
| `src/mcp/vice/package.json` — `files[]` += `anno-export-asm.ts` (MODIFIED) | config | — | the existing `files[]` block | exact |

---

## Pattern Assignments

### `src/mcp/vice/anno-export-asm.ts` (service/renderer, transform) — SHIPS

**Analog A (structure, store reads, option shape):** `src/mcp/vice/anno-memmap-render.ts`
**Analog B (ACME text emission):** `src/mcp/vice/disasm-renderer.ts`

> ⚠️ `anno-memmap-render.ts` contains a **NUL byte** and is invisible to a plain `grep`.
> Use `grep -a` when censusing it. A plain-grep census has already produced one false
> decision in this project (project memory).

**Imports pattern** — `anno-memmap-render.ts:68-75`, the exact store-read import block the
exporter should copy and extend:

```ts
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./anno-confidence.ts";
import type { ConfidenceGrade } from "./anno-confidence.ts";
import { openStore, closeStore, listRanges, listLabels, listComments } from "./anno-store.ts";
import { COMMENT_TYPES, workspaceRelativePath } from "./anno-types.ts";
import type { CommentRow, LabelRow, RangeRow } from "./anno-types.ts";
import { blockClassAt } from "./block-class.ts";
```

The exporter additionally needs `listProjectEnums`, `listEnumUsage` from `./anno-store.ts`,
`decode` from `./disasm-decoder.ts`, `render`/`renderLine` from `./disasm-renderer.ts`,
`AUTO_NAME_PREFIX_RE` from `./anno-coverage.ts`, and `assertLegalAcmeIdentifier` from
`./anno-acme-ident.ts`. It must import **nothing** from `hostpath.ts`/`containerpath.ts`
(`hostpath-consumers.test.ts` keeps a closed five-module set and will red).

**Options-object pattern** — `anno-memmap-render.ts:333-359`. Copy the *doc discipline*
verbatim, especially the "who confines this path" comment on every path field. The header of
the `provenancePath` field is the project's own record of what a silently-undocumented path
field cost (`29-REVIEW.md` CR-03):

```ts
export interface RenderMemoryMapOptions {
  /** The annotation store to render. The CALLER confines it through
   *  `storePathWithinWorkspace()` and `openStore()` below confines it again
   *  against the same `workspaceRoot`, so both answers agree by construction
   *  rather than by a second rule (T-29-51). */
  storePath: string;
  /** ... THIS FIELD WAS DOCUMENTED BY SILENCE, and the silence is what the review
   *  names as the mechanism. ... An absent comment beside a present one is a claim,
   *  and this one was false. */
  provenancePath: string;
  /** The workspace root both confinement checks are taken against. REQUIRED
   *  rather than defaulted: `openStore()`'s default behaviour is to CREATE
   *  the file, so an unconfined store path is a store file created wherever
   *  the caller's argument pointed. */
  workspaceRoot: string;
}
```

**Core pattern — one handle, all reads, `finally` close** (`anno-memmap-render.ts:418-437`).
This is the exact store-read shape to copy:

```ts
  // ONE handle for the whole render, closed in a `finally`. `mustExist` is
  // what makes "the annotations are gone" and "there are no annotations"
  // refuse differently (T-29-52): without it a mistyped path would CREATE an
  // empty store and render as an empty memory map indistinguishable from a
  // real one.
  const handle = openStore(storePath, { workspaceRoot, mustExist: true });
  let ranges: RangeRow[];
  let labels: LabelRow[];
  let lineComments: CommentRow[];
  try {
    ranges = listRanges(handle);
    labels = listLabels(handle);
    lineComments = listComments(handle).filter((c) => c.commentType === LINE_COMMENT);
  } finally {
    closeStore(handle);
  }

  const sortedBlocks = [...ranges].sort((a, b) => a.start - b.start);
  const sortedSymbols = [...labels].sort((a, b) => a.address - b.address);
  const sortedComments = [...lineComments].sort((a, b) => a.address - b.address);
```

Note also `anno-memmap-render.ts:126` — the vocabulary is read out of its one home, never
re-typed as a string literal:

```ts
/** The store's own spelling for a comment placed on its own line before the
 * instruction, read out of `COMMENT_TYPES` -- the ONE home of that
 * vocabulary -- rather than re-typed as a literal here. */
const [LINE_COMMENT] = COMMENT_TYPES;
```

**Block-kind interpretation** — never compare a `dataType` string in the exporter.
`anno-memmap-render.ts:440-446`:

```ts
  // The block listing in `block-class.ts`'s own entry shape. The `dataType`
  // column is copied VERBATIM and never compared here -- that module is the
  // one place in this tree allowed to interpret it.
  const blockEntries = sortedBlocks.map((row) => ({
    start_address: row.start,
    end_address: row.endInclusive,
    type: row.dataType as string,
  }));
```

**ACME emission pattern** — `disasm-renderer.ts:280-306`, `render()` in full. This is the
header/symbol-definition/origin layout the exporter must extend (the `hex4()` symbol
definitions are exactly Pitfall 5's hazard — a zero-page label needs 2 hex digits or `+1`):

```ts
export function render(instructions: Instruction[], opts?: RenderOptions): string {
  const resolved = resolveOptions(opts);
  const list = Array.isArray(instructions) ? instructions : [];

  const symbols = new Map<string, number>();
  const instructionLines: string[] = [];

  for (const instr of list) {
    const { text, symbol } = renderInstructionLine(instr, resolved);
    instructionLines.push(text);
    if (symbol !== undefined) symbols.set(symbol.name, symbol.address);
  }

  const lines: string[] = ["!cpu 6510"];

  const sortedSymbols = [...symbols.entries()].sort((a, b) => a[1] - b[1]);
  for (const [name, address] of sortedSymbols) {
    lines.push(`${name} = ${hex4(address)}`);
  }

  const origin = resolved.origin ?? list[0]?.address ?? 0;
  lines.push(`* = ${hex4(origin)}`);

  lines.push(...instructionLines);

  return lines.join("\n");
}
```

**The `!byte` substitution to reuse, never re-derive** — `disasm-renderer.ts:246-253`:

```ts
  if (!instr.acmeExpressible) {
    // D-09: every byte goes out as `!byte`, keeping the following
    // instruction at the correct address. The mnemonic and operand a human
    // reader needs move into the trailing comment instead.
    const { text: mnemonicOperand, symbol } = renderMnemonicOperand(instr, opts);
    const bytesHex = instr.bytes.map(hex2).join(", ");
    const comment = notesText ? `${mnemonicOperand}  [${notesText}]` : mnemonicOperand;
    return { text: `${INDENT}!byte ${bytesHex}  ; ${comment}`, ...(symbol !== undefined ? { symbol } : {}) };
  }
```

**Injection seam for store facts** — `disasm-renderer.ts:66-70`. This is the interface the
exporter injects labels through; RESEARCH.md assumption A1's stated risk is that it must
widen. Whatever the exporter needs (store labels, enum-on-immediate) goes in **here**, not
into a duplicated emitter:

```ts
export interface RenderOptions {
  showSymbols?: boolean;
  symbolFor?: (address: number) => string | undefined;
  origin?: number;
}
```

**Error-handling pattern** — the module throws a named `Error` prefixed with its own function
name and NEVER interpolates parsed file content (`anno-memmap-render.ts:393-414`). Both halves
matter: the prefix, and the CR-03 refusal to pass a parser message through.

```ts
    throw new Error(`renderMemoryMap: could not read provenance sidecar at "${provenancePath}": ${errMsg(err)}`);
    ...
    // NEVER INTERPOLATE THE UNDERLYING PARSE ERROR HERE (CR-03). ...
    throw new Error(
      `renderMemoryMap: provenance sidecar at "${provenancePath}" is not valid JSON${jsonParsePosition(err)}. ` +
        "The underlying parser message is deliberately NOT included -- it quotes the file's own bytes (CR-03).",
    );
```

**Off-by-one to carry, from RESEARCH.md § Code Examples 3 + `anno-types.ts:250-263`:**
`RangeRow.endInclusive` is INCLUSIVE; ACME's `*` after a block sits at
`endInclusive + 1`. `.planning/research/SUMMARY.md:162` records inclusive-end off-by-one as a
carried hazard with six conversion boundaries.

---

### `src/mcp/vice/acme-verify.ts` (utility / external-process oracle, request-response) — TEST-ONLY

**Analog A (test-only posture + the spawn rule):** `src/mcp/vice/acme-gate.ts`
**Analog B (the actual spawn):** `disasm-roundtrip.test.ts`'s `assemble()` (lines 88-101)

**Header pattern to copy** — `acme-gate.ts:29-33` and `:56-63`. The test-only declaration and
the *mechanically-grepped* spawn rule are the two paragraphs the new module must carry in its
own voice:

```ts
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts` files.
// `acme-gate.test.ts` asserts the `files[]` absence mechanically, on every
// suite run.
```

```ts
//   - Never build the probe's command line as a single shell-interpreted
//     string, and never swap `spawnSync`'s argv-array form for any
//     shell-spawning or string-command variant of the child-process API.
//     `ACME_BIN` is externally supplied and reaches a process launch here;
//     the argv-array form is what keeps that boundary safe. `acme-gate.ts`
//     is grepped mechanically for exactly this, so the guard cannot rot.
```

`acme-gate.ts:38-43` also explains why the module's own filename must not match `*.test.*`
even though it is test-only — the new module inherits that reasoning verbatim.

**`ACME_BIN` — import, never re-derive** (`acme-gate.ts:68`):

```ts
/** Overridable ACME binary name, matching disasm-roundtrip.test.ts's own
 * original convention exactly. */
export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";
```

Because the verify module is test-only, it **imports** this rather than resolving the env var
itself. That resolves RESEARCH.md's Pitfall 6 tension: the shipped-module branch would have
forced a second copy of the env-var name, which `acme-gate.ts:44-51` forbids by name.

**Spawn pattern** — `disasm-roundtrip.test.ts:88-101` (`assemble()`), the closest existing
thing to this phase's spawn. Copy the temp-dir discipline and the argv array; **do not** copy
`ok = r.status === 0 && existsSync(outPath)` as the verdict:

```ts
function assemble(source: string): { ok: boolean; bytes: Buffer; stderr: string } {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "disasm-roundtrip-"));
  const id = fileCounter++;
  const srcPath = join(workDir, `t${id}.a`);
  const outPath = join(workDir, `t${id}.bin`);
  writeFileSync(srcPath, source);
  const r = spawnSync(ACME_BIN, ["-f", "plain", "-o", outPath, srcPath], { encoding: "utf8" });
  const ok = r.status === 0 && existsSync(outPath);
  const bytes = ok ? readFileSync(outPath) : Buffer.alloc(0);
  return { ok, bytes, stderr: r.stderr ?? "" };
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});
```

**The second-implementation counterpart it must agree with by inspection** —
`src/skills/acme-build/scripts/acme.mjs:103-124`. The two packages cannot import each other,
so the plan must quote both sides and assert agreement on the **flag list** (not the binary
token):

```js
  const args = [
    "--cpu", "6510",              // C64: enables the 6510 illegal opcodes
    "-f", opts.format || "cbm",   // cbm = 2-byte load address, what LOAD wants
    "-Wtype-mismatch",            // catches a missing '#' on an immediate
    "--strict-segments",          // overlapping segments are reported as errors
    "--msvc",                     // machine-parseable diagnostics
    "-v1",                        // report the address range actually emitted
    "-o", prg,
    "-l", `${stem}.sym`,
    "--vicelabels", `${stem}.vs`,
  ];
  if (!opts.noReport) args.push("-r", `${stem}.rep`);
  for (const d of opts.defines) args.push(`-D${d}`);
  for (const i of opts.includes) args.push("-I", i);
  if (opts.setpc) args.push("--setpc", opts.setpc);
  args.push(src);

  const env = { ...process.env };
  if (ACME_LIB.path) env.ACME = ACME_LIB.path;
  const r = spawnSync("acme", args, { encoding: "utf8", env });
  if (r.error) {
    die(r.error.code === "ENOENT"
      ? "install the ACME cross assembler and put `acme` on PATH"
      : String(r.error));
```

Three deliberate divergences, per RESEARCH.md § Code Examples 1: `ACME_BIN` replaces the
literal `"acme"`; `r.status === 0 && existsSync(prg)` is **not** the verdict; `-v2` replaces
`-v1` (per-segment result lines are the unanimity subject, `Saving …` is the untrusted
aggregate).

**Never-throw + naming constraint:** `acme-gate.ts`'s `probeAcme()` documents the never-throw
contract (`:71-74`). And per RESEARCH.md § Anti-Patterns, do not name any local `binPath` /
`viceBin` / `VICE_BIN` / `x64sc` — `spawn-seam.test.ts:179,263-296` scans for those and
asserts an exactly-one-entry set. (Test-only placement means the scan cannot see this module,
but the naming rule costs nothing and survives a later decision to ship it.)

---

### `src/mcp/vice/anno-cli.ts` — new `export-asm` verb (controller, request-response)

**Analog:** `cmdRenderMemmap()` in the same file — the entire verb, end to end. Five parts move
together.

**1. `VERB_OPTIONS` declaration** (`anno-cli.ts:222-225`). Every option the verb's own code
**actually reads**, nothing more — a flag listed but unread is the defect this map exists
against:

```ts
export const VERB_OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "render-memmap": ["--provenance", "--out", "--force", "--check"],
  coverage: ["--store", "--out", "--force", "--sample"],
});
```

**2. `--help` synopsis** (`anno-cli.ts:133`, inside `USAGE`). The synopsis line is the
**declaration of record** for the verb's positionals — `anno-cli-path-consumers.test.ts:365-385`
parses `<...>`-shaped tokens out of it. Convention: flag values are `FILE`/`N`, optional groups
are `[--out FILE]`, and an angled token is a positional and nothing else. The line must begin at
exactly **two leading spaces** (the regex is `^ {2}<verb>\b.*$`):

```
  render-memmap <store> --provenance FILE [--out FILE] [--force] [--check]
```

**3. Arg parser** (`anno-cli.ts:301-338`, `parseRenderMemmapArgs()`). Fixed, closed option set;
a flag with no value (or a flag-shaped "value") is refused via its own `*MissingValue` field;
any other `--`-shaped token becomes `unknownOption`:

```ts
    if (a === "--out") {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) {
        outMissingValue = true;
      } else {
        out = value;
        i++;
      }
    } else if (a === "--force") {
      force = true;
    } else if (a.startsWith("--")) {
      unknownOption ??= a;
    } else {
      positional.push(a);
    }
```

**4. Confinement — the realpath, never the raw caller string** (`anno-cli.ts:419-471`). This is
the load-bearing part. Note the ordering rules the comments encode: confine **before** any
`existsSync` probe (the probe is itself an oracle), and apply a derived default **first** then
confine the result:

```ts
  // T-29-51 / T-19-22: the ONE confinement seam, the same one `coverage` puts
  // both of its caller-supplied paths through. `openStore()` downstream is
  // handed this same workspace root, so its own confinement agrees by
  // construction rather than by a second rule.
  const workspaceRoot = repoRoot();
  let storePath: string;
  try {
    storePath = storePathWithinWorkspace(store, workspaceRoot);
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
  if (!existsSync(storePath)) {
    console.error(
      `render-memmap: annotation store not found: ${storePath} -- refusing to CREATE one, because "the annotations are ` +
        'gone" and "there are no annotations" must not read the same.',
    );
    return 1;
  }
  ...
  // CR-02. The default is applied FIRST and the result confined AFTER, so the
  // derived path and a caller-supplied one are confined by the same rule --
  // rather than the default being trusted because this verb computed it.
  let outPath: string;
  try {
    outPath = storePathWithinWorkspace(out ?? join(dirname(storePath), "memory-map.md"), workspaceRoot);
  } catch (err) {
    console.error(`render-memmap: ${errMsg(err)}`);
    return 1;
  }
```

And the rule stated in the file header (`anno-cli.ts:83-87`):

> Never use the RAW caller string after confining it. `storePathWithinWorkspace()` returns the
> REALPATH, not its input, so carrying the original forward reintroduces the escape one line
> below the check that refused it — and makes every "wrote X" line name a file that is not the
> one on disk.

**5. Write path + dispatch** (`anno-cli.ts:498-524` and `:1065-1080`). `refuseOverwrite()` runs
on the writing branch only, against the CONFINED path; a write failure returns 1 with one line
rather than throwing:

```ts
  if (!refuseOverwrite(outPath, force, "render-memmap")) {
    return 1;
  }
  ...
  try {
    writeFileSync(outPath, rendered.markdown);
  } catch (err) {
    console.error(`render-memmap: could not write ${outPath}: ${errMsg(err)}`);
    return 1;
  }
  console.log(
    `render-memmap: wrote ${outPath} (${rendered.rowCount} row(s), ${rendered.unknownCount} [unknown], digest ${rendered.renderDigest})`,
  );
  return 0;
```

```ts
    switch (verb) {
      case "render-memmap":
        return await cmdRenderMemmap(rest);
      case "coverage":
        return await cmdCoverage(rest);
      default:
        console.error(`anno: unknown verb "${verb}" -- this CLI has exactly two: render-memmap and coverage\n`);
```

⚠️ The `default:` message **hardcodes "exactly two"** and names both verbs. Adding `export-asm`
requires editing that string in the same commit, or the CLI misdescribes itself.

**How `anno-cli-path-consumers.test.ts` picks the new flags up automatically** — it derives the
flag half from `VERB_OPTIONS` and the positional half from the `--help` synopsis, in **both**
directions. So a new path flag reds by name unless three edits land together (see § Shared
Patterns → Path-argument inventory).

---

### `src/mcp/vice/anno-export-asm.test.ts` (test, integration + structural)

**Analog:** `src/mcp/vice/disasm-roundtrip.test.ts`

**Gate + SKIP_REASON pattern** (`disasm-roundtrip.test.ts:57`, `:74-79`) — copy exactly. One
never-skipped gate test per ACME-dependent file, `SKIP_REASON` computed **once** at module
scope:

```ts
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

/** Computed exactly once, by the shared seam. Every ACME-dependent test in
 * this file passes this through node:test's own `{ skip }` option -- never a
 * hand-rolled early return, which would report a false PASS rather than a
 * SKIP. */
const SKIP_REASON: string | false = acmeSkipReasonFor("disasm-roundtrip.test.ts");

test("ACME availability gate (D-08)", () => {
  assertAcmeRequiredIfEnvSet(assert);
});
```

**Table-driven-from-source pattern** (`disasm-roundtrip.test.ts:33-37`) — VALIDATION.md's
"every `acmeExpressible: false` opcode exports as `!byte`" row must be driven from `OPCODES`,
never from a hand-written list:

```
//   - Never hardcode a static "known unassemblable" list for Suite C. Every
//     assertion in that suite is driven from `disasm-opcodes.ts`'s own
//     `OPCODES` table, so a future correction to that table is
//     automatically re-verified the next time this file runs.
```

**Warnings-are-not-failures rule** (`disasm-roundtrip.test.ts:38-41`) — carry verbatim; ACME
0.97 emits LXA / `JMP($xxff)` / "oversized addressing mode" warnings on byte-correct output:

```
//   - Never treat an ACME stderr WARNING as a failure. ACME 0.97 documents
//     warnings for buggy-but-legal constructs (`jmp ($xxff)`, "unstable"
//     ANE/LXA) -- `assemble()`'s `ok` is `status === 0 && the output file
//     exists`, never a check on stderr being empty.
```

**Structural / planted-violation pattern** for "the exporter reads `AUTO_NAME_PREFIX_RE` rather
than restating prefixes" — the analog is `anno-cli-path-consumers.test.ts:106-158` +
`:422-479`. Three pieces, and all three are required:

```ts
function stripComments(src: string): string { /* full quote-aware stripper, lines 106-143 */ }

/** Counts real `storePathWithinWorkspace(` CALL SITES in already-stripped
 * source. The trailing `(` is what distinguishes a call from the bare import
 * binding at the top of `anno-cli.ts` ... */
function seamCallCount(strippedSrc: string): number {
  return strippedSrc.split("storePathWithinWorkspace(").length - 1;
}

/** The ONE predicate. Both the real scan and the planted-violation controls
 * call this same function, so there is exactly one definition of "routes
 * through the seam" -- the 11-01 discipline: a structural test and its own
 * proof must share the checked logic rather than each carry a copy. */
function confinesAtLeast(strippedSrc: string, required: number): boolean {
  return seamCallCount(strippedSrc) >= required;
}
```

…and the two-direction planted controls (`:422-458`), which are the shape the "exporter must
not restate the prefixes" test needs:

```ts
  assert.equal(
    confinesAtLeast(stripComments(plantedViolation), 1),
    false,
    "the predicate must report an unconfined write -- if this passes, the real scan above is not capable of catching a violation",
  );
  assert.equal(
    confinesAtLeast(stripComments(plantedConfined), 1),
    true,
    "the predicate must NOT report a confined write -- a control that only ever refuses is indistinguishable from one that works",
  );
```

plus the comment-only control (`:460-479`), which is what stops the scan degrading into a
substring search that passes by counting its own prose.

---

### `src/mcp/vice/acme-verify.test.ts` (test, integration via child process)

**Analog:** `src/mcp/vice/acme-gate.test.ts` — this is mandatory red #1's template, verbatim.

**Why a child process, stated in the header** (`acme-gate.test.ts:11-26`) — copy the reasoning,
including the two-directions rule:

```
// WHY IT MUST BE A CHILD PROCESS: `ACME_AVAILABLE` in `acme-gate.ts` is a
// module-load `const`. By the time any test body runs, the probe has already
// happened, so assigning `process.env.ACME_BIN` in-process cannot affect it.
// No in-process test can prove criterion 1. ...
//
// TWO DIRECTIONS, NOT ONE. A FAIL observation with no paired control cannot
// distinguish "the gate fired" from "the harness broke" -- a typo'd import
// path, a syntax error or a missing file all exit non-zero too. So the same
// child run is repeated with `VICE_REQUIRE_ACME` DELETED from the environment
// (not set to an empty string ...) and must exit ZERO. Either both directions
// hold or neither observation means anything.
```

**Where the probe file lives** (`acme-gate.test.ts:28-34`) — `mkdtempSync(tmpdir())`, never the
module directory; a stray `*.test.*` there breaks `test-gate.test.ts`'s "exactly one set"
assertion, and `/tmp` here is RAM-backed:

```
// WHERE THE PROBE FILE LIVES: `mkdtempSync` under `tmpdir()`, never inside
// this module directory. ... The temp directory is removed in a `finally`,
// on the failure path too -- this host's `/tmp` is RAM-backed, so a leaked
// probe directory is leaked memory.
```

**The harness itself** (`acme-gate.test.ts:94-160`) — quote verbatim, including the
`NODE_TEST_CONTEXT` trap and the memoisation:

```ts
function runGateProbe(requireAcme: boolean): ChildRun {
  const dir = mkdtempSync(join(tmpdir(), "acme-gate-test-"));
  try {
    const probePath = join(dir, "probe.test.mjs");
    const missingBinary = join(dir, "definitely-not-acme");
    writeFileSync(
      probePath,
      `import { test } from "node:test";\n` +
        `import assert from "node:assert/strict";\n` +
        `import { assertAcmeRequiredIfEnvSet } from ${JSON.stringify(GATE_PATH)};\n` +
        `test("ACME availability gate, under a deliberately nonexistent ACME_BIN", () => {\n` +
        `  assertAcmeRequiredIfEnvSet(assert);\n` +
        `});\n`,
      "utf8"
    );

    const env: Record<string, string | undefined> = { ...process.env, ACME_BIN: missingBinary };
    if (requireAcme) env.VICE_REQUIRE_ACME = "1";
    else delete env.VICE_REQUIRE_ACME;
    // MEASURED TRAP, not a precaution: Node sets `NODE_TEST_CONTEXT` in every
    // process it runs a test file in, and a child `node --test` that inherits
    // it refuses to run any file at all -- it prints "run() is being called
    // recursively within a test file. skipping running files" and exits ZERO.
    // Inherited, the FAIL direction below would report a zero exit and read as
    // "the gate degraded into a skip" on a perfectly working gate, and the
    // control direction would pass vacuously. Both directions would then be
    // measuring the harness. Delete it.
    delete env.NODE_TEST_CONTEXT;

    const r = spawnSync(process.execPath, ["--test", probePath], {
      encoding: "utf8",
      timeout: 30_000,
      env,
    });
    return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
```

Note `process.execPath`, never a bare `"node"` (WR-20, `anno-cli-path-consumers.test.ts:490-500`
records the 2026-08-30 census that fixed the last two bare-`"node"` sites).

**The wording-is-read-from-source non-vacuity guard** (`acme-gate.test.ts:66-82`) — the analog
for "the non-zero exit is the assertion, not a broken import". The verify module's own refusal
wording gets the same treatment:

```ts
/** The gate's own refusal wording, read out of the module source rather than
 * retyped here from memory. Retyping it is how a test ends up passing for the
 * wrong reason: a typo'd import path also exits non-zero, and only matching
 * the gate's real message distinguishes "the assertion fired" from "the
 * harness broke". */
const REFUSAL_PREFIX = "VICE_REQUIRE_ACME is set but no real ACME was found at";

test("the gate's refusal wording asserted below is really present in acme-gate.ts (so this file cannot pass for the wrong reason)", () => {
  const src = readFileSync(GATE_PATH, "utf8");
  assert.ok(src.includes(REFUSAL_PREFIX), ...);
});
```

**Memoised single spawn** (`acme-gate.test.ts:134-142`, WR-11) — two assertions against ONE
failing child run, lazily computed:

```ts
let failRunCache: ChildRun | undefined;
function failRun(): ChildRun {
  if (failRunCache === undefined) failRunCache = runGateProbe(true);
  return failRunCache;
}
```

**Cost, stated rather than smuggled** (`acme-gate.test.ts:36-40`) — the new file should state
its own child-process count and wall-clock cost the same way.

---

### `.planning/phases/30-.../fixtures/` (fixture/provenance, file-I/O)

**Analog A (obligation + do/don't framing):** `.planning/phases/29-the-mcp-surface/fixtures/README.md`
**Analog B (provenance table + regeneration instructions):** `src/mcp/vice/fixtures/backend-detect/README.md`

From Analog A, copy the **"what each file is" table** and the explicit DO/DO-NOT block. The
Phase 30 README's inverse obligation is stated in the Phase 29 one and must be answered by name:

```markdown
- **DO** read these to learn what the two cases are, why the aggregate line and
  the exit code are both untrustworthy, and what a rebuilt verifier must still refuse.
- **DO NOT** assert a rebuilt parser against these bytes. They are the retired
  producer's output. A green test against them proves the new parser can read
  *the deleted tool's* format, which is precisely the evidence Phase 30 does
  not need and must not claim to have.
```

From Analog B, copy the **"these are real captures, not synthesized"** paragraph and the
provenance table shape:

```markdown
**These are real captures, not synthesized.** Each transcript is the
byte-for-byte combined stdout+stderr output of `spawnSync(binPath, ["--help"],
{ encoding: "utf8" })` -- exactly the invocation `probeBackend()`'s own
`defaultSpawnHelp()` uses -- against the binary named in its own sidecar.
Nothing here was trimmed, re-wrapped, redacted, or otherwise edited after
capture.
```

| File | Binary path | Kind | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|

…and its **Regenerating** section (exact command to re-run, what to update, "do not hand-edit
the `.txt` content itself"). Analog B also demonstrates the "known source of non-determinism,
read before re-capturing" section — worth mirroring if ACME's output carries any.

For Phase 30 the provenance row values are: producer = the **new** exporter + verify route,
assembler = `ACME 0.97 "Zem"` at `/home/henrik/.local/bin/acme`, host = this one, date =
capture date, requirement anchors `EXPORT-01`/`EXPORT-03`.

---

## Shared Patterns

### 1. ACME availability gate (skip-vs-fail)
**Source:** `src/mcp/vice/acme-gate.ts:68`, `:96-104`, `:110-122`
**Apply to:** both new test files, once each, never re-probed

```ts
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

const SKIP_REASON: string | false = acmeSkipReasonFor("<this-file>.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);   // never skipped; hard FAIL under VICE_REQUIRE_ACME
});

test("...", { skip: SKIP_REASON }, () => { /* ... */ });
```

`acme-gate.ts:44-51` forbids renaming `ACME_BIN` or `VICE_REQUIRE_ACME` — CI binds those exact
names, and a rename converts CI's hard FAIL into a silent SKIP with both sides green.

### 2. Path confinement
**Source:** `anno-types.ts`'s `storePathWithinWorkspace()`, consumed at `anno-cli.ts:427, 454, 469`
**Apply to:** every caller-supplied path on the new verb (`<store>`, `<image>` if any, `--out`)

Three-part rule, all three from `anno-cli.ts`'s header and CR-02/CR-03 comments:
1. Confine **before** any filesystem touch, including `existsSync` (a stat is itself an oracle).
2. Apply a derived default **first**, confine the result **after** — never trust a path because
   this verb computed it.
3. Use the **realpath the seam returned**; the raw caller string is dead from that line on.

### 3. Path-argument inventory (auto-audit, three edits in one commit)
**Source:** `src/mcp/vice/anno-cli-path-consumers.test.ts:161-212`
**Apply to:** every new path-shaped flag/positional on `export-asm`

Three coordinated edits, or the test reds by name:

```ts
const CLI_PATH_ARGUMENTS: readonly CliPathArgument[] = [
  { verb: "render-memmap", argument: "<store>", kind: "positional" },
  { verb: "render-memmap", argument: "--provenance", kind: "flag" },
  { verb: "render-memmap", argument: "--out", kind: "flag" },
  { verb: "coverage", argument: "<image>", kind: "positional" },
  { verb: "coverage", argument: "--store", kind: "flag" },
  { verb: "coverage", argument: "--out", kind: "flag" },
];

const NON_PATH_OPTIONS: readonly string[] = ["--check", "--force", "--sample"];

const CLI_PATH_ARGUMENT_FLOOR = 6;
```

1. Add each new path argument to `CLI_PATH_ARGUMENTS` (or the flag to `NON_PATH_OPTIONS` if it
   genuinely carries no path).
2. Raise `CLI_PATH_ARGUMENT_FLOOR` to the new measured true count. It is a **hand-pinned
   integer literal** and must stay one: *"Deriving it from `CLI_PATH_ARGUMENTS.length` (or from
   disk) would make it unfailable."*
3. Add the matching `storePathWithinWorkspace(` call site in `anno-cli.ts`. Also note: the test
   also asserts **every `VERB_OPTIONS` key is covered** by the inventory, so `export-asm` must
   appear even if it were argument-free.

### 4. CLI verb floor
**Source:** `scripts/lib/anno-cli-verbs.mjs:73` (`export const ANNO_CLI_VERB_FLOOR = 2;`) and
`src/mcp/vice/anno-verb-coverage.test.ts:178` (`assert.equal(ANNO_CLI_VERB_FLOOR, 2);`)
**Apply to:** the commit that lands `export-asm`

Both move to `3` **in the same commit**. The constant's own doc-comment: *"Each verb that lands
there raises this floor to the new true count, in the commit that adds it."* The equality is
exact (`assert.equal`), not `>=`, so raising only one side reds.

### 5. Test-file auto-discovery
**Source:** `src/mcp/vice/test-gate.mjs:95-113`
**Apply to:** both new test files — **do NOT add either to `MANUAL_ONLY_TESTS`**

```js
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  ...
]);

/** Every `*.test.*` entry in `dir`, sorted, with every MANUAL_ONLY_TESTS
 * member removed. This -- not a second glob anywhere else -- is exactly what
 * `npm run test:automated` runs. */
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}
```

A new `*.test.ts` in `src/mcp/vice/` is picked up automatically. `test-gate.test.ts`'s drift
guard fails the build if a file escapes both sets.

### 6. `files[]` closure
**Source:** `src/mcp/vice/package.json`'s `files[]` array; walked by `scripts/check-npm-packages.mjs`
**Apply to:** `anno-export-asm.ts` (**add it** — it ships, and is reachable from `anno-cli.ts`)
and `acme-verify.ts` (**do NOT add it** — test-only, mirroring `acme-gate.ts`)

The array already lists `anno-cli.ts`, `anno-memmap-render.ts`, `disasm-renderer.ts`,
`disasm-decoder.ts`, `disasm-opcodes.ts`, `anno-coverage.ts`, `anno-acme-ident.ts` — every module
the exporter imports is already shipped, so only `anno-export-asm.ts` is a new entry.
`acme-gate.test.ts` mechanically asserts `acme-gate.ts`'s **absence**; the plan should decide
whether to add the mirror assertion for `acme-verify.ts`.

### 7. Header-comment convention (WHY / ONE PLACE / WHAT NOT TO DO)
**Source:** `acme-gate.ts:1-66`, `anno-memmap-render.ts:1-67`, `anno-cli-path-consumers.test.ts:1-63`
**Apply to:** both new modules and both new test files

Four required sections, in order: **WHY THIS FILE EXISTS** (naming the concrete incident),
**WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR**, **WHAT NOT TO DO, named concretely** (each
bullet naming the specific past mistake), and — where applicable — **WHAT THIS FILE DOES NOT
CHECK** so a later reader can close the limit deliberately rather than discover it.
`anno-cli.ts:46-82` is the project's own record of what happens when a header claims a property
the code does not have: *"A header naming a maintained property is a written warrant for the
next maintainer not to check."*

---

## Findings the Planner Needs (verified this session)

1. **`AUTO_NAME_PREFIX_RE` has no cross-module production importer today.** Full census
   (`grep -rn` over `src/mcp/vice/*.ts`): it is defined at `anno-coverage.ts:1393`, used
   in-module at `:1442`, imported only by `anno-coverage.test.ts:39`, and referenced *as prose*
   at `anno-types.ts:94` and `module-classification.ts:149-150`. **The exporter would be the
   first production module in another file to import it**, so there is no existing import
   pattern to copy — the plan establishes one:

   ```ts
   import { AUTO_NAME_PREFIX_RE } from "./anno-coverage.ts";
   ```

   `anno-types.ts:93-99` forbids restating the prefixes by name.

2. **`assertCommentText()` does NOT refuse embedded newlines.** VALIDATION.md's T-30-06 row
   marks this "control unconfirmed — the plan must check it". Checked: `anno-types.ts:1391-1412`
   performs exactly three checks — `typeof !== "string"`, `/^\s*;/` leading-semicolon, and
   `utf8ByteLength > MAX_COMMENT_BYTES`. **There is no newline check.** A stored comment
   containing `\n` would emit arbitrary ACME source. The plan must either add the refusal to
   `assertCommentText()` (a store-vocabulary change with existing-row implications) or strip
   newlines at the export boundary — and say which, explicitly.

3. **`anno-cli.ts`'s `default:` dispatch case hardcodes "exactly two" and names both verbs**
   (`:1078`). Adding a third verb requires editing that string in the same commit.

4. **`anno-memmap-render.ts` contains a NUL byte** and is invisible to plain `grep`. Any
   structural test or census the plan writes over the renderer set must use `grep -a` or read
   the bytes directly.

5. **Store read surface, exact signatures** (`anno-store.ts`) — all take one `AnnoStoreHandle`
   and return an array ordered by `id`:

   | Function | Line | Returns |
   |---|---|---|
   | `openStore(path, { workspaceRoot?, mustExist?, unconfinedModuleDerivedPath? })` | 432 | `AnnoStoreHandle` |
   | `closeStore(handle)` | 569 | `void` |
   | `listRanges(handle)` | 2360 | `RangeRow[]` — `{ id, start, endInclusive, dataType, bank }` |
   | `listLabels(handle)` | 2861 | `LabelRow[]` — `{ id, address, name, kind, bank }` |
   | `listComments(handle)` | 2917 | `CommentRow[]` — `{ id, address, commentType, text, bank }` |
   | `listScopes(handle)` | 3023 | `ScopeRow[]` |
   | `listProjectEnums(handle)` | 3258 | `ProjectEnumRow[]` — `{ id, name, variants, description }` |
   | `listEnumUsage(handle)` | 3389 | `EnumUsageRow[]` — `{ id, address, enumId, enumName, bank }` |
   | `listXrefs(handle)` | 3471 | `XrefRow[]` |
   | `setLabel(...)` | 2820 | the duplicate-label refusal criterion 5 needs |

   Vocabularies in `anno-types.ts`: `DATA_TYPES` (:213, twelve members —
   `code, byte, word, address, petscii, screencode, lo_hi_address, hi_lo_address, lo_hi_word,
   hi_lo_word, external_file, undefined`), `COMMENT_TYPES` (:271, `["line","side"]`),
   `LABEL_KINDS` (:293, `["User","Auto","System","Platform"]`).

6. **`anno-index.ts` is a paint-index, not a read surface.** It exports `PAINT_INDEX_SIZE`
   (0x10000), `NO_ROW` (-1), `IndexableRange`, `buildPaintIndex(rows)` (:96) and
   `resolveAt(index, address)` (:142). The exporter's "which range covers this address"
   question is `buildPaintIndex(listRanges(handle))` + `resolveAt()` — an existing seam, not a
   new loop.

---

## No Analog Found

None. Every new file in this phase has a close in-tree analog.

The one genuinely-new construction with **no** existing template is the **three-outcome verdict
function** (`"ok" | "failed" | "skipped"`) inside `acme-verify.ts`. Its structural analog
(`disasm-roundtrip.test.ts`'s `assemble()`) is a **two**-outcome boolean and is explicitly the
wrong shape — RESEARCH.md § Code Examples 1, divergence 2: *"`acme.mjs` derives `ok` as
`r.status === 0 && existsSync(prg)` — correct for a build driver, and explicitly not the verdict
rule for this phase. Do not carry that line across."* Use RESEARCH.md § Code Examples 2's
skeleton and its six rules; the analogs supply everything around it (spawn, temp dir, gate,
header discipline) but not the verdict itself.

---

## Metadata

**Analog search scope:** `src/mcp/vice/` (modules + colocated tests), `src/skills/acme-build/scripts/`,
`scripts/lib/`, `.planning/phases/29-the-mcp-surface/fixtures/`, `src/mcp/vice/fixtures/backend-detect/`
**Files read this session:** `acme-gate.ts`, `acme-gate.test.ts`, `anno-memmap-render.ts`,
`disasm-renderer.ts`, `disasm-roundtrip.test.ts`, `anno-cli.ts`, `anno-cli-path-consumers.test.ts`,
`anno-store.ts` (export index + row shapes), `anno-types.ts` (vocabularies, `assertCommentText`),
`anno-coverage.ts:1380-1400`, `anno-index.ts` (exports), `test-gate.mjs`, `package.json`,
`scripts/lib/anno-cli-verbs.mjs`, `anno-verb-coverage.test.ts:177-181`,
`src/skills/acme-build/scripts/acme.mjs`, both fixtures READMEs
**Pattern extraction date:** 2026-08-30
