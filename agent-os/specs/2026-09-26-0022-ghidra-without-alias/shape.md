# Ghidra Without the Symlink Alias — Shaping Notes

## Scope

This is roadmap v2.0.0 "One Broker, One Socket", step 3. Ghidra projects move to
a broker-side root with no dot-prefixed path segment, and the symlink alias
(`<repoRoot>/c64-re-tools -> .c64-re-tools`) is deleted. The alias needed a
project checkout as the broker's `--repo-root`, and no v2 start route passes
one, so `ghidra.analyze` could not run under a machine-level broker at all.

## Decisions

- **New root:** `brokerGhidraDir()`, which is `VICE_BROKER_GHIDRA_DIR` when set,
  otherwise `<os.tmpdir()>/c64-re-tools-ghidra-<uid>`. It sits outside the
  broker home, which is dotted by default. A dotted root is refused by name,
  with the remedy.
- **One run, one directory:** every run gets a fresh, uniquely named project
  directory, which is removed when the run ends. The run log goes into the
  request's scratch `out/`. The Ghidra project itself is never downloaded, so
  nothing persists broker-side.
- **No run-id reuse refusal:** the per-run directory cannot collide.
- **Executor-only option:** `HostToolDeps.ghidraProjectsRoot`, set by the
  broker and never by a request. This follows the `outputDir` precedent.
- **`projectRoot` stays:** it is still the `tools.json` locator input.
- **Startup sweep:** leftover run directories are swept after the bind by
  reusing `sweepOrphanedStaging()`.
- **Redaction:** the reply scrub also covers the Ghidra root.
- **Verification:** measured against real Ghidra 12.1.3, including a broker
  with no `--repo-root` and the default dotted home.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:** one machine-level broker, and no client names a
  broker-side path. Point-of-use refusals, never a doctor command. Never
  auto-install.

## Standards Applied

- **broker/host-bound-modules:** `ghidra-project.mts`, `broker-home.mts`,
  `host-tool.mts` and `vice-broker.mts` are rebuilt into `resources/`.
- **global/injectable-deps:** `brokerGhidraDir()` takes injectable env,
  tmpdir and uid; the executor takes `ghidraProjectsRoot`.
- **global/module-header:** the `ghidra-project.mts` header is rewritten short.
- **skills/refuse-never-guess:** a dotted root is refused by name, never
  rewritten.
