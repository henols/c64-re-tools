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
    → distributes executable runtime packages where appropriate
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
install/configure Host Runtime package as needed
  ↓
report actionable missing host prerequisites
```

Corresponding convenience actions may include update/uninstall/status if they continue to delegate ownership correctly.

## 4. Host Runtime installation

The Host Runtime is installed on the host machine that owns the graphical environment and native tools.

It should run as a normal foreground executable for development/troubleshooting.

The normal user experience may additionally configure per-user desktop-session autostart so the runtime is available after login. Avoid a system-wide service model that loses access to the user's GUI environment.

Autostart is a usability feature, not an architectural dependency. Manual foreground start remains valid.

## 5. Devcontainer/headless environment

A devcontainer/agent environment should need only the lightweight client/MCP/skills side.

It should not need duplicate installations of:

- VICE;
- ACME;
- Ghidra;
- dxa;
- c1541;
- petcat;
- other host-native tools.

Those live on the host and are reached through the Host Runtime.

## 6. Version compatibility

The MCP/client and Host Runtime protocol are versioned. At connection time they verify compatibility.

On mismatch, fail early with an actionable message to update the older component. Do not continue in a partially compatible mode.

## 7. External prerequisites

c64-re-tools may detect external host tools and provide installation guidance, but should not silently install unrelated system packages as a side effect of ordinary operation.

Installation commands/remedies must be explicit and user-controlled.
