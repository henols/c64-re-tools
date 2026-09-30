# 04 — Host Runtime

## 1. Purpose

The Host Runtime exists because VICE and native C64 tooling belong on the graphical host machine, while an LLM/harness may run in a devcontainer, remote workspace or other headless environment.

The Host Runtime prevents every agent environment from needing its own VICE/Ghidra/ACME installation.

## 2. Process topology

```text
                         HOST
               ┌──────────────────────┐
MCP A ─ TCP ───┤ session A            │── VICE A
               │                      │
MCP B ─ TCP ───┤ session B            │── VICE B
               │                      │
MCP C ─ TCP ───┤ session C            │── VICE C
               │                      │
               │ shared host tools    │── ACME
               │                      │── Ghidra
               │                      │── dxa/c1541/petcat
               └──────────────────────┘
```

One Host Runtime process serves many independent connections/sessions.

## 3. Connection-owned session

A long-lived client connection is the session owner.

Startup:

```text
connect
  ↓
protocol/version handshake
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
client connection closes
  ↓
session stops accepting work
  ↓
terminate its VICE/tool processes
  ↓
remove temporary session resources
```

No emulator-selection API exists because the connection itself identifies the emulator.

## 4. Transport and discovery

Use a small versioned TCP protocol.

The client attempts the normal local/host bridge endpoints in a deterministic order, for example:

```text
127.0.0.1:<fixed-port>
host.docker.internal:<fixed-port>
host.containers.internal:<fixed-port>
```

An explicit environment override (for example `C64RE_HOST`) handles unusual environments.

No network-wide discovery protocol is needed.

The Host Runtime must bind only to intended local/bridge interfaces, not indiscriminately to the public network.

## 5. Protocol requirements

The protocol is private infrastructure, not the public product API.

It shall nevertheless be:

- strongly typed;
- request/reply correlated;
- versioned;
- bounded in message/file sizes;
- explicit about errors;
- capable of transferring binary attachments.

The client and Host Runtime perform a compatibility handshake. Incompatible versions fail immediately with actionable remediation.

## 6. File staging

Client and host must never assume that a client path is meaningful on the host.

For a host tool operation:

```text
client reads project files
        ↓
sends files/bytes over protocol
        ↓
Host Runtime creates temporary workspace
        ↓
runs native tool
        ↓
returns diagnostics + output files
```

For assemblers, stage the caller-supplied source root/directory rather than trying to parse assembler include directives on the client.

The same staging primitive can serve ACME, Ghidra, dxa, c1541, petcat and future native host tools.

## 7. Host tools

Host-tool operations are typed. A client does not send arbitrary executable paths, shell command strings or arbitrary argv as the public protocol contract.

Examples of internal operations may include:

```text
tool.acme.assemble
tool.ghidra.analyze
tool.dxa.disassemble
tool.c1541.inspect
tool.petcat.decode
```

Tool discovery/configuration lives on the host.

## 8. Process safety

- Spawn executables with argv arrays, never interpolated shell strings.
- Track every child process/group owned by a session.
- On normal Host Runtime termination, stop all children.
- Preserve/reimplement the current codebase's proven lessons for abnormal broker death so VICE/tool children do not remain orphaned.
- Bound teardown; cleanup must not become an infinite hang.

## 9. Failure behavior

### VICE crashes

The operation that encountered the crash fails clearly. The Host Runtime may start a fresh VICE for the same connection so the session remains usable, but it must report that emulator state was lost.

State-changing operations are never silently retried.

### Host Runtime crashes

The client connection fails. The MCP reports the Host Runtime failure rather than presenting a successful emulator result.

### Missing host tool

The relevant operation fails by tool name and provides an actionable remediation. Other unrelated Host Runtime functions may continue.
