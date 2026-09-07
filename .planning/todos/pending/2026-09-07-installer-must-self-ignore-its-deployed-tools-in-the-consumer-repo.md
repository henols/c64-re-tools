---
created: 2026-09-07T13:00:04.815Z
title: Installer must self-ignore its deployed tools/ in the consumer repo
area: paths
severity: minor
files:
  - src/mcp/vice/install-resources.ts:91
  - src/mcp/vice/install-resources.ts:186-194
  - src/mcp/vice/install-resources.ts:399-430
  - src/mcp/vice/install-resources.ts:523
  - src/mcp/vice/ghidra-project.mts:73
  - src/mcp/vice/host-scripts.test.ts:102-150
  - .gitignore:38-49
---

## Problem

`installResources()` copies every entry of `src/mcp/vice/resources/` into
`<repoRoot>/tools/` on the first tool call (via `ensureResourcesInstalled()`
at `repo-root.ts:208`), and it never arranges for those files to be ignored
by git. It only works today because **this** repo hand-maintains the ignore
lines:

```
$ find tools -type f | while read f; do git check-ignore -q "$f" \
    && echo "IGNORED $f" || echo "NOT-IGNORED $f"; done
IGNORED tools/backend-detect.mjs
IGNORED tools/broker-control.mjs
... (12/12 IGNORED)
```

Those 12 lines live in `.gitignore:38-49` and are kept in two-way parity with
`resourceEntries()` by `host-scripts.test.ts:120`. That gate protects *this*
repo and nothing else.

A **consumer** who installs `@henols/vice-mcp` into their own project gets the
same ~400 KB of generated launcher code written into their repo root with **no
ignore entry at all**:

| Written into the consumer's repo | By |
|---|---|
| `tools/{backend-detect,broker-control,broker-epoch,broker-kill,broker-launch,broker-state,container-guard,ghidra-project,host-tool,vice-broker}.mjs` | `installResources()` |
| `tools/vice-launcher.sh` | `installResources()` |
| `tools/.vice-deployed.json` | `writeDeployManifest()` |
| `tools/ghidra-runs/<runId>/` | `ghidra-project.mts`'s `resolveGhidraProject()` |

Consequences for the consumer:

1. `git status` is permanently dirty, in a project where the user never asked
   for these files and cannot tell them from their own content.
2. A routine `git add -A` commits ~400 KB of *generated* code that the next
   version of the plugin will silently overwrite — a diff nobody authored and
   nobody can review.
3. The plugin's own never-throw install path means the consumer gets no signal
   that this happened; the files simply appear.
4. `pruneResources()` deliberately consults only `.vice-deployed.json` and
   never walks `installTargetDir()`, precisely because `tools/` is a **mixed**
   directory that may also hold the consumer's own tracked tooling. So the
   plugin already knows it is writing into a directory it does not own — but
   still leaves the ignore problem to the human.

The plugin is the only party that knows what it deployed (it maintains an
exact manifest). It should own the ignore, the same way it owns the prune.

## Solution

Write a **self-ignoring dotfile inside the deployment target** rather than
touching the consumer's root `.gitignore`:

```
tools/.gitignore     # deployed alongside .vice-deployed.json
```

containing one line per manifest entry plus `.gitignore` and
`.vice-deployed.json` themselves. Rationale for this shape:

- A nested `.gitignore` is scoped to `tools/`, so it cannot affect anything
  else in the consumer's repo, and it needs no parsing/merging of a file the
  consumer owns and may have hand-edited. Editing a consumer's root
  `.gitignore` is the riskier design — idempotent-append is easy to get wrong
  and impossible to undo cleanly.
- It is **per-entry, not a blanket `*`**, for the same reason `.gitignore:38-49`
  is per-entry: `tools/` is a mixed directory (`install-resources.ts:186-190`,
  `host-scripts.test.ts:154-161`), so a blanket ignore would swallow the
  consumer's own tracked tooling in the same directory.
- Generate it from the same source of truth `pruneResources()` uses — the
  deploy manifest / `resourceEntries()` — so it cannot drift from what was
  actually deployed. `tools/ghidra-runs/` needs a line too, since that scratch
  tree lands under the same root.
- It must be written through the existing tmp-sibling + rename sequence and
  must obey `install-resources.ts`'s never-throw contract (D-3): a failure to
  write it degrades to a dirty consumer tree, never to a failed tool call.

Open questions to settle when this is planned:

- **Should the file be added to `resourceEntries()`/the manifest itself?**
  Making it a manifest entry means `pruneResources()` removes it on
  uninstall, which is the desired lifecycle — but it is *generated per
  deployment* rather than copied from `resources/`, so it does not fit the
  existing copy-a-tracked-file model, and `host-scripts.test.ts`'s two-way
  `/tools/` parity gate would then demand a matching `.gitignore:38-49` line
  in this repo for a file this repo does not need. Deciding this decides
  whether the gate needs a carve-out.
- **Does this repo also deploy it?** If yes, `.gitignore` gains a
  `/tools/.gitignore` line and the two ignore mechanisms overlap harmlessly.
  If no, the deploy path branches on "is this the plugin's own repo", which is
  the kind of self-reference the codebase avoids elsewhere.
- **Detect-only alternative**: instead of writing anything, have the install
  path check `git check-ignore` on each deployed entry and emit a one-time
  stderr warning naming the lines to add. Lower blast radius, but it leaves
  the consumer's tree dirty by default, which is the actual complaint.

## Relationship to the consolidate-paths todo

`2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools` is a
**different** change and neither subsumes the other:

- That one changes **where** files land (one `.c64-re-tools/` root instead of
  six scattered entries), and explicitly still expects the consumer to add
  "exactly one gitignore entry" **by hand**.
- This one makes the tool **ignore what it wrote, wherever it writes it**, so
  the consumer adds nothing by hand.

They compose: if the consolidation lands first, this work targets
`.c64-re-tools/.gitignore` and gets simpler (one root, no mixed-directory
constraint, so a blanket `*` becomes defensible). If this lands first, the
consolidation moves the generated dotfile along with the rest. Do not merge
them into one plan — the consolidation is a broad path refactor across six
seams with pinned test literals, while this is a single new write in one seam.
