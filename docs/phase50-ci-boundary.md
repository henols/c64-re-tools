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
