# Phase 19: Absorbed Procedures and the Coverage Instrument - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 21 (9 new, 12 modified)
**Analogs found:** 20 / 21

Input: `19-RESEARCH.md` (no CONTEXT.md; ROADMAP §19 Notes reproduced in RESEARCH §"Locked Decisions")
plus `upstream-procedure-manifest.json`. Every excerpt below was opened this session.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/lib/skill-descriptions.mjs` (new) | utility (pure predicates) | transform | `scripts/lib/skill-honesty-checks.mjs` | exact |
| `scripts/check-skill-description-overlap.mjs` (new) | config/CI runner | batch | `scripts/check-skill-fork-honesty.mjs` | exact |
| `src/mcp/vice/skill-description-overlap.test.ts` (new) | test | file-I/O + subprocess | `src/mcp/vice/skill-honesty-checks.test.ts` | exact |
| `src/mcp/vice/skill-attribution.test.ts` (new) | test | file-I/O (registry scan) | `src/mcp/vice/skill-consumer-paths.test.ts` | exact |
| `src/mcp/vice/anno-coverage.ts` (new) | service (census/report) | transform (bytes -> report) | `src/mcp/vice/anno-verify.ts` + `disasm-decoder.ts` | role-match |
| `src/mcp/vice/anno-coverage.test.ts` (new) | test | file-I/O + fixtures | `src/mcp/vice/anno-verify.test.ts` / `absorbed-answer-key.test.ts` | role-match |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` (new) | utility (skill script) | request-response (external oracle) | `src/skills/c64-program-recon/scripts/derive.mjs` | role-match |
| `src/mcp/vice/packer-finding.test.ts` (new) | test | file-I/O + live gate | `src/mcp/vice/anno-test-gate.ts` consumers | role-match |
| `src/skills/routine-queue-walker/SKILL.md` (new, 7th skill) | component (playbook) | event-driven (trigger match) | `src/skills/c64-program-recon/SKILL.md` | exact |
| `src/skills/c64-program-recon/SKILL.md` (mod: absorbed basic+routine) | component | event-driven | itself / `c64-memory-mapping/SKILL.md` | exact |
| `src/skills/c64-memory-mapping/SKILL.md` (mod: absorbed blocks+symbol) | component | event-driven | `c64-program-recon/SKILL.md` | exact |
| `src/mcp/vice/anno-cli.ts` (mod: `coverage` verb) | route/dispatch | request-response | its own `render-memmap` case `:1084` | exact |
| `scripts/check-npm-packages.mjs` (mod: `:235` pin + installer notices) | config/CI | batch | its own `:112-115` notices assertion | exact |
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` (mod) | config/doc | — | its own cc65 "Incorporated material" section `:9-40` | exact |
| `THIRD-PARTY-NOTICES.md` (root, mod) | config/doc | — | itself (6-line pointer) | exact |
| `installer/package.json` (mod: `files[]`) | config | — | `src/mcp/vice/package.json:75` | exact |
| `src/mcp/vice/anno-derivation.test.ts` (mod: sha256 + disposition + ABS-04) | test | file-I/O | itself + `docs-fork-decision.test.ts` | exact |
| `.planning/.../19-STDIO-MULTIPLEXING-EVIDENCE.md` (new) | doc/evidence | — | `18-STDIN-EOF-EVIDENCE.md` | exact |
| `.planning/.../evidence/measure-stdio-multiplexing.mjs` (new) | utility (driver) | request-response (subprocess) | `evidence/measure-stdin-eof-driver.mjs` | exact |
| `CLAUDE.md` Project Skills table (mod) | doc | — | existing table row | exact |
| `installer/skills/routine-queue-walker/` (generated) | generated artifact | file-I/O | `installer/scripts/sync-skills.mjs` output | exact |

## Pattern Assignments

### ABS-03 — the three-file pattern (`skill-descriptions.mjs` / `check-skill-description-overlap.mjs` / `skill-description-overlap.test.ts`)

**Analogs:** `scripts/lib/skill-honesty-checks.mjs`, `scripts/check-skill-fork-honesty.mjs`,
`src/mcp/vice/skill-honesty-checks.test.ts`. This is the exact shape RESEARCH §4.1 prescribes.

**Why the predicate module exists at all** — copy this reasoning verbatim into the new module's
header (`scripts/lib/skill-honesty-checks.mjs:1-27`):

```js
#!/usr/bin/env node
// scripts/lib/skill-honesty-checks.mjs -- shared predicates for
// `scripts/check-skill-fork-honesty.mjs`, proven non-vacuous by a committed
// test (`src/mcp/vice/skill-honesty-checks.test.ts`) that this module
// makes possible in the first place.
//
// `check-skill-fork-honesty.mjs` runs its whole check at import time (it is
// a plain top-level script, not a function you can call), so none of its
// inline predicates could ever be proven non-vacuous by a committed test --
// only by re-running the live script and reading its exit code, which says
// nothing about whether the PREDICATE itself, in isolation, actually
// distinguishes a violation from a clean file. ...
//
// Lives under `scripts/lib/`, not `src/mcp/vice/`, on purpose: neither
// export has a runtime role in the shipped MCP server, so this file must
// stay out of `src/mcp/vice/package.json`'s `files[]` ...
//
// Both exports take content as STRINGS -- never a path to import, require,
// eval or spawn.
```

**Predicate signature/return shape** (`scripts/lib/skill-honesty-checks.mjs:40-53`) — a list of
violation strings, `[]` when clean; the new `descriptionCollisions()` should return an array of
collision records the same way:

```js
export function fileClaimViolations(content, { forbidden = [], required = [] } = {}) {
  const violations = [];
  for (const needle of forbidden) {
    if (content.includes(needle)) {
      violations.push(`forbidden claim "${needle}" is present`);
    }
  }
  for (const needle of required) {
    if (!content.includes(needle)) {
      violations.push(`required claim "${needle}" is absent`);
    }
  }
  return violations;
}
```

**Runner pattern** — imports the corpus walker rather than re-deriving it
(`scripts/check-skill-fork-honesty.mjs:54-71`):

```js
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CAPABILITY_REGISTRY } from "../src/mcp/vice/capability-registry.ts";
import { fileClaimViolations, isStandaloneDisasmToken } from "./lib/skill-honesty-checks.mjs";
import { walkSkills, MCP_PREFIX_RE, TOOL_NAME_RE, topLevelSkillDirs } from "./lib/skill-corpus.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILLS_DIR = join(ROOT, "src/skills");

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

const skillFiles = walkSkills(SKILLS_DIR);
```

Reusable exports available from `scripts/lib/skill-corpus.mjs` (do NOT write a second walker —
the WR-12 lesson): `walkSkills(dir)` `:39`, `MCP_PREFIX_RE` `:70`, `TOOL_NAME_RE` `:71`,
`extractToolNames(text)` `:79`, `topLevelSkillDirs(dir)` `:90`.

**Failure/report shape** (`scripts/check-skill-tool-coverage.mjs:493-496`):

```js
if (errors.length) {
  console.error("check-skill-tool-coverage: FAIL");
  for (const e of errors) console.error("  - " + e);
```

Success line must be `check-skill-description-overlap: OK -- ...` carrying skills scanned,
`pairsCompared`, observed max score + the pair, threshold, allowlist size (RESEARCH §4.5).

**Non-vacuity floor pattern — floors, never equalities** (`scripts/check-skill-tool-coverage.mjs:379-382`
and `:445-448`):

```js
need(
  topLevelDirs.length >= 6 && topLevelDirs.every((d) => dirsWithAFileRead.has(d)),
  `non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got ${topLevelDirs.length} directories (${[...dirsWithAFileRead].length} with a file read)`
);
need(
  extractedAnno.size >= 10,
  `non-vacuity: expected at least 10 distinct anno_* names extracted from src/skills/, got ${extractedAnno.size} -- the extraction regex or plan 11-12's skill edits may have regressed`
);
```

**Planted-violation test pattern** (`src/mcp/vice/skill-honesty-checks.test.ts:14-27, 37-66`) — note
it imports the *same* module the CI script imports, and ends with a live-execution control:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fileClaimViolations, isStandaloneDisasmToken } from "../../../scripts/lib/skill-honesty-checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const CI_SCRIPT = join(ROOT, "scripts", "check-skill-fork-honesty.mjs");
```

```ts
test("planted-violation: both the false claim present AND the true claim missing yields two violations", () => {
  const synthetic = "usage: new <file.a>  scaffold a C64 program (BASIC stub + libs)\n";
  const violations = fileClaimViolations(synthetic, WR11_SPEC);
  assert.equal(violations.length, 2);
  ...
});

test("live-execution control: check-skill-fork-honesty.mjs exits 0 with OK in its output", () => {
  const result = spawnSync(process.execPath, [CI_SCRIPT], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check-skill-fork-honesty: OK/);
});
```

---

### The two pinned counts that go red when the 7th skill lands

**`scripts/check-npm-packages.mjs:230-235`** — the exact-equality pin, verbatim:

```js
const inst = packFiles(join(ROOT, "installer"));
need(inst.name === "@henols/c64-re-tools", `installer: name is "${inst.name}", expected "@henols/c64-re-tools"`);
need(inst.files.includes("bin/cli.mjs"), "installer: missing bin/cli.mjs (bin entry)");
const skillMds = inst.files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
need(skillMds.length === 6, `installer: expected 6 skills with SKILL.md, found ${skillMds.length}`);
```

Fix per RESEARCH §5.5 and project memory ("assert relations, not counts"): replace the literal `6`
with the count of top-level dirs under `src/skills/` that contain a `SKILL.md`. The relation-side
enumeration already exists in `scripts/package.sh:110-118`:

```js
// Every skill directory must carry a SKILL.md.
const skillsDir = path.join(root, "src/skills");
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory() && !fs.existsSync(path.join(skillsDir, d.name, "SKILL.md")))
      errors.push(`skill "${d.name}" has no SKILL.md`);
```

**`scripts/check-skill-tool-coverage.mjs`** — the ABS-01 gate. It is a plain token grep (`:88`),
so absorbed prose must not contain a non-curated `anno_*` literal:

```js
const ANNO_TOOL_NAME_RE = /\banno_[a-z0-9_]+/g;
```

Its failure site, verbatim (`:400-406`):

```js
for (const [name, files] of extractedAnno) {
  need(
    CURATED_ANNO_TOOLS.includes(name),
    `${name}: referenced by ${[...files].join(", ")} but NOT in CURATED_ANNO_TOOLS (anno-tools.ts). ` +
      `Resolve by: (1) implementing it and adding it to ANNO_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.`
  );
}
```

Scope is `src/skills` only (`:55` `const SKILLS_DIR = join(ROOT, "src/skills");`) — so omission
notes naming `anno_toggle_splitter` belong in `.planning/`, never in a skill file. Do **not** add
an `anno_*` allowlist to this script.

**New CLI verb constraint** — `coverage` must be named by a skill file or the same script fails
(`:481-491`):

```js
const missingCliVerbs = verbsMissingFromSkills(annoCliVerbs, skillTexts);
for (const verb of missingCliVerbs) {
  const req = VERB_REQUIREMENT[verb] ? ` (${VERB_REQUIREMENT[verb]}'s delivery path)` : "";
  need(
    false,
    `anno ${verb}: parsed from anno-cli.ts's dispatch switch but named by NO skill file${req}. ` +
      `Resolve by: (1) documenting it in a playbook, (2) removing the verb, or (3) recording it as a scope decision.`
  );
}
```

`scripts/lib/anno-cli-verbs.mjs:40` is `export const ANNO_CLI_VERB_FLOOR = 7;` used as `>=`, so
8 verbs is safe.

---

### ABS-02 — attribution and notices

**Analog for the new "Incorporated material" section:** `src/mcp/vice/THIRD-PARTY-NOTICES.md:9-31`
(cc65). Copy its structure exactly — heading names the material and licence, then provenance
(path, commit, date), then the licence-obligation paragraph, then the fenced licence text:

```markdown
## Incorporated material — cc65 (zlib)

The 6502/6510 opcode table in `disasm-opcodes.ts` (mnemonics, addressing
modes, instruction lengths) is transcribed by hand from cc65's
`src/da65/opc6502x.c`, fetched raw
(`https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opc6502x.c`)
against `master` @ commit `547d923588d870aacf0b0016c67d0f6a92a70f83`
(2026-07-11). ...

cc65 is zlib-licensed, copyright cc65's own author:
```

**The claim absorption falsifies** (`src/mcp/vice/THIRD-PARTY-NOTICES.md:78-84`, verbatim):

```markdown
## Build/CI tools — not incorporated: The external analyser

The external analyser is invoked as an **external CLI subprocess** (Phase 10's
`ANNO-09` bootstrap and `ANNO-06` reassembly proof) against a real,
locally-installed `the external analyser` binary. **No the external analyser source,
data table, or output is included in this repository or in either
published package**, so its licence does not attach to anything shipped.
```

And the opening enumeration (`:7`):

```markdown
**No GPL-licensed material is incorporated into this package: ...** Every source named below is either zlib-licensed (incorporated), reference-only (nothing copied), or a build/test-time subprocess whose licence therefore never attaches to anything shipped.
```

Both must be narrowed/widened per RESEARCH §5.2. Root `THIRD-PARTY-NOTICES.md` is a 6-line
pointer only:

```markdown
# Third-Party Notices

The canonical third-party notices for the published `@henols/vice-mcp`
package live at
[`src/mcp/vice/THIRD-PARTY-NOTICES.md`](src/mcp/vice/THIRD-PARTY-NOTICES.md).
This project itself is MIT-licensed — see [`LICENSE`](LICENSE).
```

**Installer `files[]` (must gain a notices entry)** — `installer/package.json:9-13`:

```json
  "files": [
    "bin/",
    "skills/",
    "README.md"
  ],
```

Assert it the way the vice-mcp side already is (`scripts/check-npm-packages.mjs:110-115`):

```js
// --- D-07 / criterion 5: the notices file must actually ship ---------------
need(
  vice.files.includes("THIRD-PARTY-NOTICES.md"),
  "vice-mcp: missing THIRD-PARTY-NOTICES.md -- criterion 5 requires the opcode table's zlib provenance to ship with the package (D-07)"
);
```

(the matching `files[]` entry is `src/mcp/vice/package.json:75`).

**`skill-attribution.test.ts` shape:** use the *frozen registry* discipline of
`src/mcp/vice/skill-consumer-paths.test.ts:26-45` — presence AND absence, never a substring both
forms satisfy; content-anchored regions, never line numbers:

```ts
// THE DISCIPLINE EVERY ASSERTION HERE FOLLOWS: presence of the consumer
// form AND absence of the source-tree form, NEVER a substring both forms
// satisfy. A registry entry with only a presence check, or only an absence
// check, is exactly the defect class this file exists to close -- do not
// add one.
//
// REGISTRY, NOT A SCAN: unlike this codebase's corpus-scanning guards
// (`hop-chain-comments.test.ts`, `comment-phase-pointers.test.ts`), the four
// sites here are known, named, and fixed in number -- a frozen four-entry
// registry, ... and -- for the
// one file that also legitimately carries the source-tree form elsewhere ...
// a CONTENT-anchored region to scope the absence check to, never a line number
```

Applied here: presence of the six attribution header fields + the manifest's `commit`/`sha256`;
absence of the literal `.agent/skills` under `src/skills/**` and `installer/skills/**`.

---

### ABS-04 — the dated decision with a named re-sync trigger

**Analog:** `src/mcp/vice/docs-fork-decision.test.ts`. Its header states why a prose decision
needs a guard, and it supplies the two reusable primitives: a *named non-empty phrase set* whose
own length is asserted (so an emptied set cannot vacuously pass) and *section isolation that
returns `null` on a renamed heading*.

`docs-fork-decision.test.ts:17-42`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const PROJECT_MD = join(ROOT, ".planning/PROJECT.md");

/** Named, non-empty set of reversal-trigger phrases the FORK-01 row must
 * carry at least one of, verbatim. Its own length is asserted non-zero in
 * test 1 below, so an emptied set cannot make test 5's check vacuously
 * pass by finding nothing to check. */
const REVERSAL_PHRASES: readonly string[] = ["reverses if", "would reverse", "reversal criteria"];

/** Isolates the `## Key Decisions` table body: everything from that heading
 * up to (not including) the next `## ` heading. Returns `null` if the
 * heading cannot be found -- a renamed heading must FAIL the tests that
 * depend on it, not silently scan an empty string. */
function keyDecisionsSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Key Decisions\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}
```

**Extension target** — `src/mcp/vice/anno-derivation.test.ts` in full (it is short; the whole
file is the analog for the ABS-01/ABS-04 additions):

```ts
const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json"), "utf8"));

test("Phase 19 pins and classifies all five upstream analysis procedures", () => {
  assert.equal(manifest.repository, "an upstream repository");
  assert.match(manifest.commit, /^[0-9a-f]{7,40}$/);
  assert.equal(manifest.procedures.length, 5);
  for (const procedure of manifest.procedures) {
    assert.match(procedure.path, /^\.agent\/skills\/anno-analyze-/);
    assert.match(procedure.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!procedure.destination.includes(".agent/skills"));
    for (const disposition of Object.values(procedure.tools) as string[]) {
      assert.ok(["curated", "omit", "adapt-to-address-input"].includes(disposition));
    }
  }
});
```

Note `procedures[2].destination` is already `src/skills/routine-queue-walker` — the 7th skill's
name is fixed by the committed manifest.

---

### COV-01/COV-02 — the coverage instrument

**Byte-stream analog (reuse, do not rebuild):** `src/mcp/vice/disasm-decoder.ts:140-151` — this is
the "independent instruction stream" the ROADMAP note demands:

```ts
 * `startAddress`. Bounded by construction (T-04-03-01): a single `while`
 * loop over a byte cursor, every iteration consumes at least one byte, no
 * recursion anywhere in this file. Never throws -- malformed input ...
 * returns `[]` rather than wrapping the address into range and returning a
 * plausible-looking but wrong listing.
 */
export function decode(bytes: Uint8Array, startAddress: number, opts: DecodeOptions = {}): Instruction[] {
  if (!(bytes instanceof Uint8Array)) return [];
  if (!isValidStartAddress(startAddress)) return [];
```

The census's recursive-descent walker must be written the same way (bounded, never-throws,
no recursion into transport code) — note `decode()` itself is non-recursive, so the walker owns
its own explicit worklist.

**On-disk project read analog:** `src/mcp/vice/anno-project.ts:135-149` — the symmetric writer
that defines the format the census reads (`raw_data_base64` = gzip+base64):

```ts
export function synthesizeProject(bytes: Uint8Array, opts: SynthesizeOptions): string {
  const { origin, system = ANNO_SYSTEM_C64 } = opts;

  if (!Number.isInteger(origin) || origin < 0 || origin > 0xffff) {
    throw new Error(
      `synthesizeProject: origin ${origin} is out of range -- expected an integer 0..0xffff (0..65535)`,
    );
  }
  if (bytes.length === 0) {
    throw new Error("synthesizeProject: payload is empty -- a .regen2000proj must carry at least one byte");
  }

  const raw_data_base64 = gzipSync(bytes).toString("base64");
```

**Module-header pattern for a report that must never trust an aggregate** —
`src/mcp/vice/anno-verify.ts:1-26` is the closest analog and its lesson is COV-01's own
("three distinct numbers, never one aggregate"):

```ts
#!/usr/bin/env node
// anno-verify.ts -- the ONE place that interprets the external analyser's
// `--verify` output.
//
// WHY PARSING IS REQUIRED AT ALL (D-10, the concrete incident): ...
// -- exit 0, and a summary line that reads as a full pass, while the one
// assembler this project actually cares about ... never
// ran at all. ... This is the WHAT-NOT-TO-DO for any
// future edit to this file: never derive `ok` from `status`, ever ...
// never from the aggregate "All roundtrip verifications passed." summary
// line, which is itself the thing that lied in the transcript above.
```

And its no-host-path rule, which the new coverage module inherits (`anno-verify.ts:43-45`):

```ts
// Import nothing from `hostpath.ts`/`containerpath.ts` -- plan 10-01's
// absence assertion in `hostpath-consumers.test.ts` already names this file.
```

**Confidence vocabulary — reuse, never re-spell** (`src/mcp/vice/anno-confidence.ts:81-93`):

```ts
export const CONFIDENCE_GRADES: readonly ConfidenceGrade[] = [
  {
    token: "confirmed-code",
    bracket: "[confirmed-code]",
    phrase: "confirmed code",
    meaning: "Executed during tracing, PC observed inside it",
  },
  {
    token: "probable-code",
    ...
```

Exports available: `CONFIDENCE_GRADES` `:81`, `parseConfidencePrefix()` `:175`,
`formatConfidenceComment()` `:203`.

**Sealed-answer-key analog for COV-01's third number** —
`src/mcp/vice/absorbed-answer-key.test.ts:1-55`. Copy its three named failure classes and its
"missing/empty must FAIL, never skip" rule:

```ts
//   3. T-11-RETROFIT / T-11-VACUOUS-CHECK: SESSION-B-ANSWER.md's own
//      canonical line, hashed under QUESTION.md's exact canonicalisation
//      rules, must equal the sealed ANSWER.sha256 -- and this check must FAIL
//      (never skip) when SESSION-B-ANSWER.md is missing or its fenced block
//      is empty, so a non-answer can never read as a vacuous pass.
```

with its path/marker constants (`:34-54`):

```ts
const EVIDENCE_DIR = join(HERE, "..", "..", "..", ".planning", "phases",
  "11-annotation-store-enums-and-the-symbol-round-trip", "evidence", "criterion1");
const ANSWER_PATH = join(EVIDENCE_DIR, "ANSWER.md");
const ANSWER_SHA_PATH = join(EVIDENCE_DIR, "ANSWER.sha256");
const OPEN_MARKER = "<!-- CANONICAL-ANSWER-LINE -->";
const CLOSE_MARKER = "<!-- /CANONICAL-ANSWER-LINE -->";
```

**CLI verb wiring analog** — `src/mcp/vice/anno-cli.ts:1050-1090`. Add `case "coverage":` beside
`render-memmap`; note `checkAcceptedOptions()` runs before dispatch, so the new verb's option set
must be registered there:

```ts
export async function runAnnoCli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;

  if (!verb || verb === "--help" || verb === "-h") {
    console.log(USAGE);
    return 0;
  }

  const optionError = checkAcceptedOptions(verb, rest);
  if (optionError) {
    console.error(optionError);
    console.log(USAGE);
    return 1;
  }

  try {
    switch (verb) {
      case "bootstrap":
        return cmdBootstrap(rest);
      ...
      case "render-memmap":
        return await cmdRenderMemmap(rest);
      default:
        console.error(`anno: unknown verb "${verb}"\n`);
```

---

### SURF-03 — the packer finding (skill script, not a tool)

**Analog:** `src/skills/c64-program-recon/scripts/derive.mjs:1-10` — a skill script that "contacts
nothing" and takes values the agent already fetched:

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Pure derivation over values the agent already fetched. Contacts nothing.
//
// The mcp__plugin_c64-re-tools_vice__* tools are the only route to the emulator (.claude/CLAUDE.md
// § Emulator Access). This script therefore takes register values as arguments
// and RAM as a file, and performs only the arithmetic that a lookup table
// cannot: register bits -> concrete addresses.
```

The packer finding differs on exactly one axis — it may spawn an *external* oracle (`unp64`) —
so it needs the live-gate discipline from `src/mcp/vice/anno-test-gate.ts:36-56`, adapted with
`UNP64`/`UNP64_PATH` and `VICE_REQUIRE_UNP64`:

```ts
export const ANNO_BIN: string = process.env.ANNO_BIN ?? "the external analyser";

/** Spawns `${ANNO_BIN} --version` with a 10s timeout ... Never throws: a spawn error
 * (e.g. ENOENT) is treated as "not available", not a test failure. */
export function probeAnno(): boolean {
  const r = spawnSync(ANNO_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /analyser/i.test(banner);
}

/** Evaluated exactly once, at module load ... */
export const ANNO_AVAILABLE: boolean = probeAnno();
```

Header note to copy from the same file (`:24-33`) — a test-only helper must stay out of `files[]`
and must not match the `*.test.*` glob:

```ts
// This module is TEST-ONLY. It must never appear in package.json's `files[]` ...
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file ...
```

**CI-placement constraint** (`src/mcp/vice/ci-suite-coverage.test.ts:166-167`): a colocated skill
test must match the proven glob, or add a `build`-job step:

```ts
const SKILLS_SCRIPTS_DIR_RE = /^src\/skills\/[^/]+\/scripts$/;
const SKILLS_GLOB_PROOF = "src/skills/*/scripts/*.test.mjs";
```

Note `:74` `const SKIP_RELATIVE_PATHS = new Set<string>(["installer/skills"]);` — the synced copy
is exempt, so a `packer-finding.test.mjs` under `src/skills/c64-program-recon/scripts/` is already
covered; a `packer-finding.test.ts` under `src/mcp/vice/` is covered by `npm test`.

---

### New / modified skills (`routine-queue-walker`, plus the two absorption targets)

**Frontmatter + opening shape** — `src/skills/c64-program-recon/SKILL.md:1-26`. Note: frontmatter
is exactly `name` + `description` (one long description carrying the capability sentence then
`Use when asked to …` trigger clauses — the very structure ABS-03 parses), then an H1, then a
"do not do the expensive thing first" paragraph, then a `bash` block naming the script path from
the repo root, then the "contacts nothing" caveat:

```markdown
---
name: c64-program-recon
description: Work out how an unknown C64 program is structured at runtime — entry point, interrupt handlers, main loop, game states, graphics and sound — in a fixed order, before disassembling anything. Use when asked to reverse engineer a C64 game, find the main loop, entry point or IRQ handler, locate the player sprite, charset or music player, identify a game state machine, work out which memory regions are code versus data, or decide where to start on a depacked image.
---

# Reconnaissance on an unknown C64 program

**Do not disassemble the whole program first.** ...

```bash
D=src/skills/c64-program-recon/scripts/derive.mjs   # from the repo root

node $D vectors dump.bin                                # $01 + six vectors, which pair is live
```

The script does only the arithmetic that a lookup table cannot — register bits to concrete
addresses — over values **you** fetched through `mcp__plugin_c64-re-tools_vice__*`. It contacts nothing.
```

Directory layout to mirror: `SKILL.md` + `scripts/` + optional `references/*.md` +
`templates/*.template.md` (as in `c64-program-recon/`: `references/{control-flow,graphics,observation-hazards,reconstruction,sound-and-input,tool-selection}.md`,
`templates/memory-map.template.md`).

The attribution header goes immediately **after** the frontmatter as an HTML comment
(RESEARCH §5.4 supplies the exact 6-field block; frontmatter must stay first for discovery).

**Sync + generated-copy rule** — `installer/scripts/sync-skills.mjs:1-6` and `:31-36`:

```js
// Copies the canonical skills from the repo's src/skills/ into installer/skills/
// so `npm pack`/`npm publish` bundles them into the @henols/c64-re-tools tarball.
// The canonical source of truth stays src/skills/ ...
// installer/skills/ is a generated, gitignored copy regenerated on every
// pack via the package's `prepack` script.
```

```js
const HERE = dirname(fileURLToPath(import.meta.url)); // installer/scripts
const INSTALLER_ROOT = dirname(HERE); // installer
const REPO_ROOT = dirname(INSTALLER_ROOT); // repo root
const SRC = join(REPO_ROOT, "src", "skills");
const DEST = join(INSTALLER_ROOT, "skills");
```

Its header (`:8-16`) also records that the copier's exclusion rule is deliberately *not* shared
with `check-npm-packages.mjs` — the gate must be able to catch the producer being wrong. Preserve
that; do not "deduplicate" it while touching either file.

---

### D18-16 — the stdio-serialism evidence artifact

**Doc analog:** `.planning/phases/18-persistent-session-and-tool-surface/18-STDIN-EOF-EVIDENCE.md`.
Section order to copy exactly: title (`# D18-NN: <thing> measurement`), a metadata block
(Plan / Date / Binary / `--version` output), `## Question`, `## Method` (numbered, explaining why
the shape isolates the child's own behaviour), `## Exact command sequence` (a `bash` block),
`## Observed outcome`:

```markdown
# D18-23: stdin-EOF orphan measurement

**Plan:** 18-04, task 3(b)
**Date:** 2026-08-24
**Binary:** `the external analyser` at `/home/henrik/.cargo/bin/analyser`
**`--version` output:** `the external analyser 0.9.20`

## Question
...
This is D18-23's own open question. It is answered here by measurement
against the real binary, not assumed either way.

## Method
...
## Exact command sequence

```bash
The external analyser --version
# the external analyser 0.9.20

cd .planning/phases/18-persistent-session-and-tool-surface/evidence
node measure-stdin-eof-driver.mjs
```
```

**Driver analog:** `.planning/phases/18-.../evidence/measure-stdin-eof-driver.mjs:1-23, 34-50` —
self-contained, prints one JSON result line, imports the real shipped `synthesizeProject()` by
`pathToFileURL`, honours `ANNO_BIN`, and bounds its poll:

```js
#!/usr/bin/env node
// measure-stdin-eof-driver.mjs -- plan 18-04 task 3(b) (D18-23). Orchestrates
// the whole measurement: ... then polls whether the child is still alive, up to
// POLL_BOUND_MS, printing one JSON result line.
//
// Usage: node measure-stdin-eof-driver.mjs
// Requires `the external analyser` on PATH (or ANNO_BIN pointing at it).
import { spawn, execSync } from "node:child_process";
...
const HERE = dirname(fileURLToPath(import.meta.url));
const POLL_BOUND_MS = 15_000;
const POLL_INTERVAL_MS = 200;
```

```js
  const annoProjectPath = join(HERE, "..", "..", "..", "..", "src", "mcp", "vice", "anno-project.ts");
  const { synthesizeProject } = await import(pathToFileURL(annoProjectPath).href);

  const dir = mkdtempSync(join(tmpdir(), "d18-23-stdin-eof-"));
  const projectPath = join(dir, "measure.regen2000proj");
  writeFileSync(projectPath, synthesizeProject(new Uint8Array([0]), { origin: 0xc000 }));

  const bin = process.env.ANNO_BIN || "the external analyser";
  const versionOutput = execSync(`${bin} --version`).toString().trim();
```

Filename must not contain `.test.` (so `ci-suite-coverage.test.ts` stays unaffected) — the two
Phase 18 drivers establish that.

## Shared Patterns

### Module-header doctrine (applies to every new `.ts`/`.mjs` file)
**Source:** `src/mcp/vice/anno-verify.ts:1-26`, `src/mcp/vice/anno-cli.ts:10-33`,
`scripts/lib/skill-honesty-checks.mjs:1-27`.
**Apply to:** all new modules. Header states (1) WHY the file exists, naming the concrete
incident/requirement; (2) what it is the ONE place for; (3) an explicit "WHAT NOT TO DO, named
concretely" block. `anno-cli.ts:10-14`:

```ts
//   WHAT NOT TO DO, named concretely:
//   - Never accept a caller-supplied passthrough of extra flags to
//     the external analyser (D-07). Every child-process argv is built only by
//     `anno-launch.ts`'s fixed builders ...
```

### Import conventions
**Source:** `scripts/check-skill-fork-honesty.mjs:54-59`, `src/mcp/vice/docs-fork-decision.test.ts:17-23`.
**Apply to:** all new files. Node builtins as `node:*`; every relative import carries its real
extension (`.ts`, `.mts`, `.mjs`); no path aliases; `.mjs` scripts may import `.ts` directly
(type-stripping); `const HERE = dirname(fileURLToPath(import.meta.url))` is the idiomatic anchor,
and `repoRoot({ from: HERE })` is the resolver for repo-root (never a hand-rolled `".."` chain in
`src/mcp/vice/*.ts`; the `.planning/` drivers and `scripts/` use explicit `join(HERE, "..", ...)`).

### CI-script error accumulation
**Source:** `scripts/check-skill-fork-honesty.mjs:66-69`, `scripts/check-skill-tool-coverage.mjs:493-496`.
**Apply to:** `check-skill-description-overlap.mjs`. Accumulate into `errors[]` via
`need(cond, msg)`, print every failure, exit 1; success prints one `check-<name>: OK -- <metrics>`
line. Never throw.

### Shrink-by-failing allowlist
**Source:** `scripts/check-skill-tool-coverage.mjs` header (`FORK_ONLY_UNRECOVERABLE` /
`PENDING_LATER_PHASE`), quoted in RESEARCH §4.4: *"The allowlist below is designed to SHRINK BY
FAILING, not grow silently … An allowlist that can only ever grow is how a coverage check rots
into a permanent exemption."*
**Apply to:** ABS-03's collision allowlist — every entry `{ a, b, clause, reason, decidedOn }`,
asserted still-live, stale entries FAIL.

### Floors, not equalities
**Source:** `scripts/check-skill-tool-coverage.mjs:379-382, 445-448`; `scripts/lib/anno-cli-verbs.mjs:40`.
**Apply to:** every new census assertion, and the `check-npm-packages.mjs:235` fix. Project memory:
"assert relations, not counts."

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/mcp/vice/anno-coverage.ts`'s widened indirect-dispatch scan (multi-entry tables, split lo/hi tables, the RTS-trick sliding window) | service | transform | Nothing in this repo walks a 6502 dispatch table. `disasm-decoder.ts` supplies the instruction stream and `resolvedTarget`, but the reachability walker, the table reconstruction and the RTS-trick matcher are genuinely new. Use RESEARCH §3.2 step 3 as the specification and §3.7's gap table as the requirement list. |

Partial-analog note: the description-similarity metric itself (normalisation, clause split,
Jaccard) has no code analog either — RESEARCH §4.2 is the spec. Only its *file shape* is
analog-covered (the three-file pattern above).

## Metadata

**Analog search scope:** `scripts/`, `scripts/lib/`, `src/mcp/vice/`, `src/skills/`, `installer/`,
repo root docs, `.planning/phases/18-*/`.
**Files opened this session:** 26 (excerpts above are verbatim from those reads).
**Pattern extraction date:** 2026-08-24
