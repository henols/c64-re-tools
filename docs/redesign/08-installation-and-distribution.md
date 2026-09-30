# 08 — Installation and distribution

## 1. Goal

Installation should be low-friction across multiple agent harnesses without making c64-re-tools responsible for maintaining another general-purpose package manager.

## 2. Existing package handlers

Use existing ecosystem mechanisms for their own domains:

```text
skills package handler
    → installs/updates/removes skills

MCP package/config handler
    → installs/registers/updates MCP integration

npm package
    → distributes executable/shared runtime packages where appropriate
```

The current repository already demonstrates this direction with the `skills` CLI for skills and `add-mcp` for MCP configuration. The rewrite should continue to delegate to established handlers rather than duplicating their harness-specific configuration logic.

## 3. Convenience installer

A convenience entry point may exist, for example:

```text
npx c64-re-tools install
```

Its responsibility is orchestration, not package management invention:

```text
detect relevant environment/harnesses
  ↓
invoke existing skill installer
  ↓
invoke existing MCP installer/config handler
  ↓
install/configure shared runtime and Host Runtime package as needed
  ↓
report actionable missing host prerequisites
```

Corresponding convenience actions may include update/uninstall/status if they continue to delegate ownership correctly.

## 4. Shared runtime package

The lightweight client/skill environment may depend on a shared runtime package that provides common deterministic infrastructure such as:

- Host Runtime client;
- file staging/transfer client logic;
- project-root resolution;
- normalized result/error types;
- knowledge API/importer;
- hashing/validation helpers.

Skills should depend on this shared implementation rather than copying infrastructure into each skill directory.

The exact package layout is an implementation choice.

## 5. Host Runtime installation

The Host Runtime is installed on the host machine that owns the graphical environment and native tools.

It should run as a normal foreground executable for development/troubleshooting.

The normal user experience may additionally configure per-user desktop-session autostart so the runtime is available after login. Avoid a system-wide service model that loses access to the user's GUI environment.

Autostart is a usability feature, not an architectural dependency. Manual foreground start remains valid.

## 6. Devcontainer/headless environment

A devcontainer/agent environment should need only the lightweight client/MCP/skills/shared-runtime side.

It should not need duplicate installations of:

- VICE;
- ACME;
- Ghidra;
- dxa;
- c1541;
- petcat;
- other host-native tools.

Those live on the host and are reached through the Host Runtime.

## 7. Compatibility handling

Skills, MCP/client code, shared runtime and Host Runtime may perform whatever internal compatibility checks are required for safe operation.

Those details are implementation infrastructure.

Normal LLM-facing behavior must not expose:

- package versions;
- protocol versions;
- wire-format versions;
- database schema versions;
- compatibility negotiation details.

On an incompatibility, fail early with an actionable message that the installation is incompatible/incomplete and cannot perform the requested operation.

Exact version/detail information may be available through an explicit human diagnostic/status command.

## 8. External prerequisites

c64-re-tools may detect external host tools and provide installation guidance, but should not silently install unrelated system packages as a side effect of ordinary operation.

Installation commands/remedies must be explicit and user-controlled.
