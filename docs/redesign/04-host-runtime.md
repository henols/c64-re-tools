# 04 — Host Runtime

## 1. Purpose

The Host Runtime exists because VICE and native C64 tooling belong on the graphical host machine, while an LLM/harness may run in a devcontainer, remote workspace or other headless environment.

The Host Runtime prevents every agent environment from needing its own VICE/Ghidra/ACME installation.

## 2. Process topology

```text
                         HOST
               ┌──────────────────────┐
MCP A ─ TCP ───┤ VICE session A       │── VICE A
MCP B ─ TCP ───┤ VICE session B       │── VICE B
MCP C ─ TCP ───┤ VICE session C       │── VICE C
               │                      │
skill scripts ─┤ short-lived tool ops │── ACME
               │                      │── Ghidra
               │                      │── dxa/c1541/petcat
               └──────────────────────┘
```

One Host Runtime process serves many independent VICE sessions and independent short-lived native-tool requests.

## 3. VICE session connections

A long-lived MCP connection is the VICE-session owner.

Startup:

```text
connect
  ↓
internal compatibility handshake
  ↓
launch VICE
  ↓
connect required monitor interfaces
  ↓
verify ready
  ↓
READY
```

Shutdown:

```text
MCP connection closes
  ↓
session stops accepting work
  ↓
terminate its VICE/tool processes
  ↓
remove temporary session resources
```

No emulator-selection API exists because the connection itself identifies the emulator.

## 4. Short-lived native-tool requests

Skill scripts use independent request/response operations for native host tools.

```text
skill script
    ↓
stage bytes/tree
    ↓
typed host-tool request
    ↓
native tool runs
    ↓
structured result/files returned
    ↓
request-owned temporary resources removed
```

These requests:

- do not create or select a VICE instance;
- do not inherit an MCP VICE session;
- do not access project knowledge;
- are bounded and deterministic;
- own and clean up only the native-tool resources they create.

This path serves ACME, Ghidra, DXA, c1541, petcat and similar host-native tools.

## 5. Transport and discovery

Use a small private transport suitable for both long-lived VICE-session connections and short-lived host-tool requests.

The client attempts normal local/host bridge endpoints in a deterministic order, for example:

```text
127.0.0.1:<internal-port>
host.docker.internal:<internal-port>
host.containers.internal:<internal-port>
```

An explicit environment override may handle unusual environments.

No network-wide discovery protocol is needed.

The Host Runtime must bind only to intended local/bridge interfaces, not indiscriminately to the public network.

Transport/discovery details are internal infrastructure and are never normal LLM-facing information.

## 6. Protocol requirements

The private protocol shall be:

- strongly typed;
- request/reply correlated;
- internally compatibility-checked;
- bounded in message/file sizes;
- explicit about errors;
- capable of transferring binary attachments.

Compatibility mismatches fail immediately inside the runtime/client layer.

Normal skill or MCP results must not expose protocol/package version values to the LLM. They are translated into an actionable incompatible/incomplete-installation failure.

## 7. File staging

Client and host must never assume that a client path is meaningful on the host.

For a host tool operation:

```text
client reads project files
        ↓
sends files/bytes over private transport
        ↓
Host Runtime creates temporary workspace
        ↓
runs native tool
        ↓
returns structured diagnostics + output files
```

For assemblers, stage the caller-supplied source root/directory rather than trying to parse assembler include directives on the client.

The same staging primitive can serve ACME, Ghidra, DXA, c1541, petcat and future native host tools.

Staging paths remain internal.

## 8. Host tools

Host-tool operations are typed. A caller does not send arbitrary executable paths, shell command strings or arbitrary argv as a public contract.

Examples of internal operations may include:

```text
tool.acme.assemble
tool.ghidra.analyze
tool.dxa.disassemble
tool.c1541.inspect
tool.petcat.decode
```

Tool discovery/configuration lives on the host.

The caller receives domain-level structured results suitable for its skill, not raw command lines or process metadata.

## 9. Process safety

- Spawn executables with argv arrays, never interpolated shell strings.
- Track every child process/group owned by its VICE session or short-lived request.
- On normal Host Runtime termination, stop all children.
- Preserve/reimplement the current codebase's proven lessons for abnormal broker death so VICE/tool children do not remain orphaned.
- Bound teardown; cleanup must not become an infinite hang.

## 10. Failure behavior

### VICE crashes

The operation that encountered the crash fails clearly. The Host Runtime may start a fresh VICE for the same MCP connection so the session remains usable, but it must report that emulator state was lost.

State-changing operations are never silently retried.

### Host Runtime crashes

The client operation fails. The MCP/skill reports that the required host service became unavailable rather than presenting a successful result.

### Missing host tool

The relevant operation fails with an actionable missing-capability/tool message. Other unrelated Host Runtime functions may continue.

### Internal compatibility failure

Fail before performing the operation and expose only an actionable incompatible/incomplete-installation message to the LLM. Exact internal version information is reserved for explicit human diagnostics.
