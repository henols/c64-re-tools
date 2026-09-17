---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-04]
criterion: ROADMAP Phase 50 success criterion 5
written: 2026-09-16
---

# Phase 50: the CI boundary

Phase 50's pipeline has two halves and they are not interchangeable. One half a
GitHub runner executes on every push. The other half needs a real Commodore 64
running under a real emulator, and no runner has one.

This document states where the line falls, so nobody has to infer it. Every
claim below about what CI runs names a step in `.github/workflows/ci.yml`; every
claim about what a step covers names a file in this repository.

## What a GitHub runner executes

The runner executes the whole offline segment: **store → export → assemble →
gate → byte-diff**. Nothing in it needs an emulator.

| Segment step | What it does | Where it runs |
|---|---|---|
| store | The committed annotation store is loaded through `importStoreDocument()`, the store's own public import verb, from `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json` | `src/mcp/vice/hazard-subject-reassembly.test.ts`, `src/mcp/vice/anno-store-export.test.ts` |
| export | The loaded store is written out as an ACME source tree by `exportAsmTree()` | `src/mcp/vice/anno-export-asm.test.ts`, `src/mcp/vice/hazard-subject-reassembly.test.ts` |
| assemble | The exported tree is handed to a real ACME through `verifyAcmeAssemblesTree()` | `src/mcp/vice/acme-verify.test.ts`, `src/mcp/vice/hazard-subject-reassembly.test.ts`, `src/mcp/vice/disasm-roundtrip.test.ts` |
| gate | Phase 49's reassembly gate is run over real inputs, for the committed subject and again for the modified one | `src/mcp/vice/reassembly-gate-run.test.ts`, `src/mcp/vice/reassembly-gate-modified-run.test.ts`, `src/mcp/vice/reassembly-gate.test.ts`, `src/mcp/vice/reassembly-gate-ack.test.ts`, `src/mcp/vice/reassembly-gate-movement.test.ts` |
| byte-diff | The assembled bytes are compared against the exporter's own expected bytes | `src/mcp/vice/acme-verify.test.ts`, `src/mcp/vice/hazard-subject-reassembly.test.ts` |

The comparison instrument itself also has hermetic tests that need no emulator —
`src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` — and those
run in CI too.

Four workflow steps carry this, all in the `build` job:

1. **`Install ACME cross-assembler (DISASM-03 round-trip gate)`** — installs
   `acme` from the distribution archive and then proves the installed binary
   really is ACME by running it and grepping its own banner. A wrong package
   name or a broken install fails the job loudly rather than letting the later
   steps skip quietly.
2. **`Assemble the acme-build scaffold (library-free)`** — runs
   `node --test skill-acme-build-cli.test.ts` in `src/mcp/vice` with
   `VICE_REQUIRE_ACME: "1"`.
3. **`Test`** — runs `npm test` in `src/mcp/vice` with `VICE_REQUIRE_ACME: "1"`.
   That is the full `*.test.*` glob, so every file in the table above runs here.
   `VICE_REQUIRE_ACME` is what turns "ACME absent" from a named SKIP into a hard
   FAIL, so the assemble and byte-diff steps are a real gate on a runner rather
   than a vacuous pass.
4. **`Test the skills`** — runs `node --test 'src/skills/*/scripts/*.test.mjs'`,
   which is how the comparison instrument's own tests reach CI. The `src/mcp/vice`
   glob in step 3 is cwd-only and non-recursive, so it structurally cannot reach
   them.

**This segment needs no emulator.** Its only host prerequisite beyond Node is
the assembler, and the workflow already installs it in step 1. Phase 50 adds no
new prerequisite of any kind.

## What a GitHub runner cannot execute

Every **behavioural** comparison in this phase needs a running C64. A GitHub
runner has none, and this project never auto-installs one: the standing rule is
to detect an external tool and refuse by name with the remedy, never to make one
appear.

So the whole live half is a **named manual step**, run by a developer on a host
with genuine unpatched stock VICE (`/usr/bin/x64sc`, reporting `x64sc (VICE 3.9)`
on the machine that produced the committed record). The artifacts it produces,
by path:

- `docs/phase50-equivalence-transcript.md` — the instrument, the capture
  procedure, the mask calibration, the red control on a planted regression, and
  the green comparison against the rebuild.
- `docs/phase50-modifiability-transcript.md` — one behaviour removed and one
  added, both observed taking effect in the emulator.
- `.planning/phases/50-equivalence-and-modifiability/evidence/captures/` — five
  committed 64K captures (`original-a`, `original-b`, `regressed`, `rebuild`,
  `modified`), each with a `.state.json` chip-state sidecar.
- `.planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs`
  and `.../make-sidecar.mjs` — the drivers that produced them.

These are committed *results*, not reproducible-on-demand steps. CI can read
them. CI cannot regenerate them, and does not pretend to.

## What CI checks about the manual half

CI does **not** read a transcript's prose. CI does **not** re-derive a
transcript's result. A freshness check is not a re-run, and nothing here should
be read as one.

CI checks exactly three things, and all three live in
`src/mcp/vice/phase50-transcript-freshness.test.ts`:

1. **Freshness.** Every `prg_sha256` recorded in a transcript's frontmatter is
   recomputed from the file named by its `prg_path` and compared. A mismatch
   fails, naming the transcript, the subject, both digests and the remedy. This
   is what catches a transcript that has gone stale because its subject binary
   changed underneath it — the failure mode where a reader treats an obsolete
   record as a current pass.
2. **No orphans.** A transcript naming a `.prg` that no longer exists in the
   tree fails as an ORPHAN.
3. **No green without a red.** A transcript carrying a `## Green ...` section
   and no `## Red ...` control section is refused. ROADMAP criterion 2 says a
   green-only result is refused as evidence; this makes that mechanical instead
   of leaving it to a reviewer's memory.

An empty transcript set fails too. If the discovery pattern ever matches
nothing, the guard reports that it checked nothing rather than reporting a pass.

The guard reads files and hashes them. It launches no process, opens no socket
and needs no assembler, so it runs unchanged on a bare runner. It lives in
`src/mcp/vice/`, so the `Test` step's existing glob picks it up: **no workflow
change was needed to put it in CI, and none was made.**

## Only committed synthetic fixtures

The whole pipeline runs on the purpose-built hazard subject and its variants,
all committed under `src/mcp/vice/fixtures/hazard-subject/`:

- `hazard-subject.prg` and `hazard-subject.annostore.json` — the subject and its
  annotation store.
- `hazard-subject-regressed.prg` — the red control's planted-regression twin.
- `hazard-subject-modified.prg`, `hazard-subject-modified.annostore.json` and
  `hazard-subject-modified.allowlist.json` — the one-removed / one-added subject
  and its pre-registered allowlist.
- `.planning/phases/50-equivalence-and-modifiability/evidence/hazard-subject-rebuild.prg`
  — the rebuild produced from the subject's own committed store. A build output,
  committed so the record is checkable, not a hand-authored fixture.

**No copyrighted disk image is used anywhere in this pipeline, and none is
available to this phase.** The untracked images under
`.planning/phases/23-*/evidence/corpus/` (`danish.d64`, `saeger.d64`) sit on one
developer's disk, are not in git, and are not part of this pipeline. Applying
the pipeline to a real title is a later requirement (`FUT-05`), not this one.

## How to run each half

**The CI half**, exactly as the `Test` step runs it:

```
cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test
```

and the skills half, exactly as the `Test the skills` step runs it:

```
node --test 'src/skills/*/scripts/*.test.mjs'
```

**The local half:**

```
cd src/mcp/vice && npm run test:automated
```

**The hazard, stated plainly: the wide `npm test` glob hangs locally outside a
devcontainer.** The workflow's own `Test` step comment records the decision and
its reason — CI runs the wide glob *deliberately*, because measured on GitHub
Actions every one of `test-gate.mjs`'s manual-only entries runs to completion
there with zero failures in under two minutes, "including ... the two suites
that hang locally outside a devcontainer". The same comment states that
`npm run test:automated` "exists for local/devcontainer ergonomics (avoiding the
local hang), not as CI's contract". So: use `npm run test:automated` locally, and
never quote a bare `npm test` as a local verification command.

One more local hazard, for anyone recording a result from these commands: do not
pipe either command into `tail`, `head` or anything else. A shell pipeline
reports the **last** command's exit status, which makes a red run look green.
Redirect to a file and read `$?` on the same line.

**The manual half** is a live session against genuine unpatched stock VICE. Its
procedure is not restated here — `docs/phase50-equivalence-transcript.md`'s
`## Capture procedure` section is the record of how it was actually run, and a
refreshed transcript is produced by repeating it, never by hand-editing a
recorded digest.

## A broken step, observed going red

ROADMAP criterion 5 asks for a broken step to be **observed** reddening CI, not
asserted to be capable of it. The observation exists in two layers.

### Layer one: asserted on every run, not observed once

`src/mcp/vice/phase50-transcript-freshness.test.ts` carries seven negative cases
that build a broken tree in a scratch directory and assert the guard reports it:
a stale digest, an orphaned reference, a green section with no red control, a
subject with no `prg_path`, a transcript with no `subjects:` block, an empty
transcript set, and the paired positive case that stops the refusal cases passing
for the wrong reason. They run under the `Test` step on every CI run, so the
broken condition is re-proved continuously rather than having been seen once by
one developer.

Measured 2026-09-16: `node --test phase50-transcript-freshness.test.ts` reports
11 tests, 11 pass, 0 fail.

### Layer two: one real break, planted, observed, reverted

**Date:** 2026-09-16 (break planted 05:25:42Z, reverted 05:26:36Z).

**The exact break.** One character in one committed file. In
`docs/phase50-equivalence-transcript.md`, line 13, the `hazard-subject` subject's
recorded digest had its first character changed from `8` to `9`:

```diff
@@ -13 +13 @@ subjects:
-    prg_sha256: 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
+    prg_sha256: 99846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
```

Nothing else was touched. The subject binary itself was left alone, which is the
point: this is exactly the shape a real staleness takes -- a recorded digest that
no longer describes the file committed beside it.

**The exact command**, with the environment CI's `Test` step sets:

```
cd src/mcp/vice
VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts
```

Neither run below was piped through anything. A shell pipeline reports the last
command's exit status, which would have made the red run look green. Each run was
redirected to a file and its `$?` read on the same line; the `EXIT=` line at the
end of each block below is that exit status.

**The failing output, verbatim:**

```
✖ every committed phase-50 transcript is fresh, unorphaned, and pairs its green result with a red control (3.862971ms)
✔ the committed docs/ directory really does hold at least two phase-50 transcripts (0.356185ms)
✔ a recorded digest that no longer matches the file on disk fails, naming both digests and the remedy (0.945444ms)
✔ a transcript naming a .prg that does not exist on disk fails as an ORPHAN (0.343768ms)
✔ a transcript carrying a green section and no red control is REFUSED (0.442875ms)
✔ the same transcript with a paired red control passes (0.363805ms)
✔ a directory holding no phase-50 transcript at all FAILS rather than passing vacuously (0.272891ms)
✔ a transcript subject with no prg_path fails rather than being skipped (0.282233ms)
✔ a transcript matching the pattern but carrying no subjects: block fails (0.306435ms)
✔ topLevelHeadings ignores a `## ` line quoted inside a fenced code block (0.20618ms)
✔ topLevelHeadings does not mistake a ### subsection for a ## section (0.121505ms)
ℹ tests 11
ℹ suites 0
ℹ pass 10
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 109.799027

✖ failing tests:

test at phase50-transcript-freshness.test.ts:285:1
✖ every committed phase-50 transcript is fresh, unorphaned, and pairs its green result with a red control (3.862971ms)
  AssertionError [ERR_ASSERTION]: the committed phase-50 transcripts no longer describe the tree they were written against
  + actual - expected
  
  + [
  +   'phase50-equivalence-transcript.md: STALE -- subject `hazard-subject` (`src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg`) recorded sha256 99846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828 but the committed file now hashes to 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828. The transcript describes a binary that no longer exists in this tree, so its recorded result must not be read as a current pass. REMEDY: a transcript cannot be regenerated by a build -- re-run the live capture session against genuine stock VICE (docs/phase50-ci-boundary.md, section "How to run each half") and commit a fresh transcript. Do NOT hand-edit the recorded digest to match: that reinstates the stale record this check exists to catch.'
  + ]
  - []
  
      at TestContext.<anonymous> (file:///home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/phase50-transcript-freshness.test.ts:286:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ 'phase50-equivalence-transcript.md: STALE -- subject `hazard-subject` (`src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg`) recorded sha256 99846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828 but the committed file now hashes to 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828. The transcript describes a binary that no longer exists in this tree, so its recorded result must not be read as a current pass. REMEDY: a transcript cannot be regenerated by a build -- re-run the live capture session against genuine stock VICE (docs/phase50-ci-boundary.md, section "How to run each half") and commit a fresh transcript. Do NOT hand-edit the recorded digest to match: that reinstates the stale record this check exists to catch.' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
EXIT=1
```

**The same break against the whole local gate**, to show it reddens the aggregate
and not just one file
(`cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm run test:automated`):

```
ℹ tests 3684
ℹ suites 21
ℹ pass 3674
ℹ fail 1
ℹ cancelled 0
ℹ skipped 9
ℹ todo 0
EXIT=1
```

That is the same 3684-test run that reports `fail 0` on a clean tree, reduced to
`pass 3674 / fail 1` by a single altered character.

**The revert.** `git checkout -- docs/phase50-equivalence-transcript.md`, after
which `git status --porcelain docs/phase50-equivalence-transcript.md
docs/phase50-modifiability-transcript.md src/mcp/vice/fixtures/hazard-subject`
printed nothing.

**The passing output after the revert, verbatim:**

```
✔ every committed phase-50 transcript is fresh, unorphaned, and pairs its green result with a red control (2.696074ms)
✔ the committed docs/ directory really does hold at least two phase-50 transcripts (0.230129ms)
✔ a recorded digest that no longer matches the file on disk fails, naming both digests and the remedy (0.795949ms)
✔ a transcript naming a .prg that does not exist on disk fails as an ORPHAN (0.311676ms)
✔ a transcript carrying a green section and no red control is REFUSED (0.413705ms)
✔ the same transcript with a paired red control passes (0.339357ms)
✔ a directory holding no phase-50 transcript at all FAILS rather than passing vacuously (0.251956ms)
✔ a transcript subject with no prg_path fails rather than being skipped (0.266013ms)
✔ a transcript matching the pattern but carrying no subjects: block fails (0.263519ms)
✔ topLevelHeadings ignores a `## ` line quoted inside a fenced code block (0.186425ms)
✔ topLevelHeadings does not mistake a ### subsection for a ## section (0.097425ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 86.563875
EXIT=0
```

### The stronger evidence, not yet obtained

The observation above was made **locally**, against the exact command and the
exact environment CI's `Test` step uses, on 2026-09-16. It was **not** made on a
GitHub runner.

The stronger evidence would be pushing the same one-character break on a scratch
branch, opening a pull request, observing the `build` job go red, then closing the
pull request and deleting the branch.

**The developer was asked, and declined that run. Decision recorded 2026-09-16.**

The local observation is accepted as sufficient for this criterion. What it rests
on, stated plainly so a later reader can re-judge it rather than inherit it:

- The command observed is the command CI runs, not an approximation of it:
  `VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts`, run from
  `src/mcp/vice`, in the same environment CI's `Test` step establishes.
- The guard sits under CI's existing test glob and is absent from
  `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, so no workflow change was needed to make
  CI run it. That claim is checkable: `grep -ac 'phase50-transcript-freshness'
  test-gate.mjs` returns 0, and `.github/workflows/ci.yml` is unchanged by the
  plan that added the guard.
- The planted break reddened the aggregate gate as well as the single file, so the
  failure is not confined to a hand-picked invocation.

**The residual, stated rather than absorbed:** no GitHub Actions run has been
observed going red for this guard. The inference from "red locally under CI's own
command and environment" to "red on a GitHub runner" is sound but is an inference,
not an observation. Plan 50-07's flagged assumption **P5** stays unresolved on
that basis. Anyone who wants the observation can still take the four steps named
at the top of this section; nothing here forecloses it.

This is a declined verification, not a passed one. It is recorded as a decision
with a date and a named residual, which is the only honest form a decline can
take. Recording it as an observation would be a fabricated result, which is the
same failure this whole document exists to make impossible.
