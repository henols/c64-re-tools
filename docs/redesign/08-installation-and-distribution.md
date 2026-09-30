# 08 — Installation and distribution

## 1. Goal

Installation should be low-friction across multiple agent harnesses without making c64-re-tools responsible for maintaining another general-purpose package manager or a separate packaging format.

The packaging system is an edge concern. Core C64 functionality, skills, MCP behavior, Host Runtime behavior and project knowledge must not depend on a particular packaging tool.

## 2. Portable package foundation

Use the portable Agent Plugins layout as the distribution baseline where practical:

```text
plugin root
├── plugin.json
├── skills/
│   ├── c64-emulator/
│   │   ├── SKILL.md
│   │   ├── scripts/
│   │   └── references/
│   └── ...
└── mcp.json
```

The portable core contains:

- Agent Skills in the standard skill layout;
- the VICE MCP declaration;
- companion skill scripts/references;
- ordinary package metadata.

Do not place c64-re-tools-specific runtime architecture into the plugin manifest.

The skills remain valid Agent Skills independently of the packaging/build tool.

## 3. Cross-harness packaging

Use `@jalco/ap-sdk` as the preferred cross-harness packaging/build/install adapter.

Its role is to:

- map the portable source package into supported harness-native layouts/configuration;
- install/register the skills;
- install/register the MCP declaration;
- carry companion skill files;
- reduce harness-specific packaging code maintained by c64-re-tools.

AP SDK is not a runtime dependency of the C64 architecture.

Keep it isolated to the distribution layer so it can be replaced later without changing:

- skill workflows;
- skill script contracts;
- MCP operations;
- Host Runtime protocol/behavior;
- knowledge schema/API.

Conceptually:

```text
skills + MCP declaration + package metadata
                 ↓
         distribution adapter
             (AP SDK)
                 ↓
      harness-native installation
```

## 4. Distribution sources

Support normal ecosystem distribution:

```text
GitHub repository
npm packages
```

The preferred end-user entry point should be a single convenience command, conceptually:

```text
npx @henols/c64-re-tools install
```

The exact published package name is settled during implementation.

The installer delegates to the packaging/runtime mechanisms; it is not a new package manager.

## 5. Convenience installer responsibilities

The convenience installer should orchestrate only what is required:

```text
detect relevant harness/environment
  ↓
install/configure portable plugin through AP SDK
  ↓
ensure required lightweight runtime/client pieces exist
  ↓
configure the VICE MCP for the harness
  ↓
report host-side prerequisites that still need attention
```

Useful companion actions may include:

```text
install
update
uninstall
status/diagnose
```

These commands should remain thin orchestration around established package/configuration mechanisms.

## 6. Shared runtime package

The lightweight client/skill environment may depend on shared TypeScript/runtime source that provides deterministic infrastructure such as:

- Host Runtime client;
- file staging/transfer client logic;
- project working-directory handling;
- normalized result/error types;
- knowledge API/importer;
- hashing/validation helpers.

Skills should not copy this infrastructure.

Where practical, release builds bundle the small shared runtime pieces needed by skill scripts into self-contained JavaScript artifacts. This avoids depending on harness-specific Node module resolution while preserving one maintained source implementation.

In particular, released skill scripts must not locate MCP internals through filesystem ladders or sibling-package path probing. The harness working directory is the project root; project-relative path validation, knowledge access and the Host Runtime client come from maintained shared source and are bundled/packaged deterministically. See [17 — Project root and local state](17-project-root-and-local-state.md).

The exact source-package names remain an implementation choice.

## 7. MCP distribution

The packaged MCP declaration configures only the stateful VICE MCP.

The MCP executable should be distributed through npm or an equivalent normal executable package mechanism and be runnable without manual source checkout.

Packaging must not broaden the MCP into a gateway for DXA, Ghidra, ACME, c1541, petcat or knowledge operations.

## 8. Host Runtime installation

The Host Runtime is installed on the host machine that owns the graphical environment and native tools.

It is intentionally separate from harness/plugin installation because the harness may run inside a devcontainer or another environment that cannot safely install software into the host OS.

Provide an explicit host-side installation entry point, conceptually:

```text
npx @henols/c64-re-tools host install
```

The Host Runtime should remain runnable as a normal foreground executable for development/troubleshooting.

The normal user experience may additionally configure per-user desktop-session autostart so the runtime is available after login. Avoid a system-wide service model that loses access to the user's GUI environment.

If the harness runs directly on the host, the convenience installer may detect that situation and simplify the flow, but the architectural separation remains.

## 9. Devcontainer/headless environment

A devcontainer/agent environment should need only:

- installed skills;
- the VICE MCP/client;
- skill scripts;
- lightweight shared/bundled runtime code.

It should not need duplicate installations of:

- VICE;
- ACME;
- Ghidra;
- dxa;
- c1541;
- petcat;
- other host-native tools.

Those live on the host and are reached through the Host Runtime.

## 10. Compatibility handling

Skills, MCP/client code, shared runtime, packaging adapter and Host Runtime may perform whatever internal compatibility checks are required for safe operation.

Those details are implementation infrastructure.

Normal LLM-facing behavior must not expose:

- package versions;
- protocol versions;
- wire-format versions;
- database schema versions;
- plugin-format versions;
- compatibility negotiation details.

On an incompatibility, fail early with an actionable message that the installation is incompatible/incomplete and cannot perform the requested operation.

Exact version/detail information may be available through an explicit human diagnostic/status command.

## 11. External prerequisites

c64-re-tools may detect external host tools and provide installation guidance, but should not silently install unrelated system packages as a side effect of ordinary operation.

Installation commands/remedies must be explicit and user-controlled.

## 12. Packaging non-goals

Do not:

- build a new multi-harness package manager;
- embed harness-specific paths/configuration throughout the project;
- make skills depend on AP SDK APIs at runtime;
- make the Host Runtime depend on the plugin packaging format;
- duplicate the same skill for every harness;
- expose packaging compatibility details to the LLM.

The intended rule is:

> Keep the product portable; use AP SDK to absorb harness-specific packaging work at the distribution edge.
