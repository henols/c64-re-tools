# 16 — Host Runtime native-tool contracts

## 1. Status

This document freezes the v1 logical contracts used by skill scripts to execute native host tools through the shared runtime/Host Runtime.

These contracts are private implementation APIs, not MCP tools and not direct LLM-facing surfaces.

The five v1 native-tool capabilities are:

~~~text
ACME assembly
DXA analysis
Ghidra analysis
c1541 disk inspection/extraction
petcat BASIC decoding
~~~

DXA has no special packaging or ownership status. It is an external host-native prerequisite discovered, validated and invoked through the Host Runtime in exactly the same architectural manner as the other native tools.

Packer/unpacker tooling is defined separately when its concrete implementation is selected.

## 2. Two boundaries

There are two distinct boundaries:

~~~text
skill script
    ↓
shared runtime facade
    ↓
private transport/staging
    ↓
Host Runtime adapter
    ↓
native executable
~~~

### Skill-side facade

The skill-side facade accepts project-relative paths and C64-domain values.

It is the contract skill scripts code against.

### Private wire

The shared runtime reads project files, transfers bytes/trees, uses private request/attachment handles as needed, and materializes a temporary host workspace.

Wire handles, hashes, temporary paths, protocol versions and request IDs are implementation details.

They never appear in normal skill output or LLM context.

## 3. Shared rules

All native-tool operations follow these rules.

### Typed allowlist only

There is no generic:

~~~text
run executable
run command
argv[]
shell string
~~~

operation.

The Host Runtime chooses the executable and constructs argv from the typed request.

### No shared-path assumption

A project-relative path is meaningful only on the skill/client side.

The shared runtime reads that path and transfers its contents.

The Host Runtime receives staged bytes/trees, not a client filesystem path.

### No caller-selected executable

The caller cannot provide:

- executable paths;
- Ghidra installation paths;
- Ghidra script paths;
- ACME library paths;
- arbitrary native options.

Tool discovery/configuration is host-owned.

### No shell

Native tools are spawned with executable + argv array only.

### Bounded execution

Each operation has a server-owned timeout and bounded stdout/stderr/result accumulation.

The skill/LLM does not choose timeout values.

### Request-owned resources

Temporary workspaces and children belong to one request and are removed/killed when the request ends.

### Parse before durable write

Host-tool execution never modifies knowledge.db.

Analyzer results return to the project side first. Local deterministic code validates/normalizes/imports them transactionally.

## 4. Project-relative path

Every facade path is relative to the resolved project root.

Rules:

- no absolute paths;
- no parent traversal outside the project;
- path must resolve inside the project;
- source-tree staging cannot escape through symlinks.

For a staged source tree, the transfer representation contains ordinary files/directories only. A symlink may be followed by the client only when its resolved target remains inside the selected source root; otherwise staging refuses it.

## 5. Common C64 types

### Address

Use the same canonical address form as the VICE MCP:

~~~text
$0000 .. $ffff
~~~

### AddressRange

~~~json
{
  "start": "$2000",
  "end": "$20ff"
}
~~~

Inclusive start/end.

### SeedLabel

~~~json
{
  "address": "$2100",
  "name": "update_player"
}
~~~

### Diagnostic

~~~json
{
  "severity": "error",
  "file": "main.a",
  "line": 42,
  "message": "..."
}
~~~

severity:

~~~text
error
warning
note
~~~

file is source-root-relative where a source location exists.

Host absolute paths never appear.

## 6. Output attachments

Large/binary results cross the private transport as attachments.

Logical skill-side results refer to their role, not to host paths.

Examples:

~~~text
program bytes
DXA listing
extracted disk entry
~~~

The shared runtime materializes attachment bytes for the calling skill script.

The caller decides whether and where those bytes are written into the project.

No native tool writes directly into a caller-selected project path on the host.

## 7. Failure model

There are two categories.

### Infrastructure/tool execution failure

Examples:

- required native tool missing;
- Host Runtime unavailable;
- timeout;
- malformed native output;
- expected result artifact missing;
- tool crashes.

The operation fails and produces no analyzer-importable partial result.

Internal error categories may include:

~~~text
tool-unavailable
invalid-input
timeout
tool-failed
invalid-output
result-too-large
installation-incomplete
~~~

Normal LLM-facing skill output translates these into actionable prose without protocol/version/path details.

### Valid domain-negative result

Some native operations can execute correctly while the requested domain operation does not succeed.

Examples:

- ACME reports source errors;
- a disk filename is not present.

These should return structured domain results when useful rather than masquerading as transport failure.

## 8. ACME facade

Logical operation:

~~~text
acme.assemble
~~~

### Input

~~~json
{
  "sourceRoot": "src",
  "entrySource": "main.a",
  "includeDirs": [
    "lib"
  ],
  "defines": {
    "DEBUG": 1
  },
  "setPc": "$0801"
}
~~~

Rules:

- sourceRoot is a project-relative directory;
- entrySource is relative to sourceRoot and must remain inside it;
- the entire sourceRoot tree is staged;
- includeDirs are optional directories relative to sourceRoot;
- project include files outside sourceRoot are not discovered by parsing source; choose a sourceRoot that contains them;
- defines is optional;
- define names use assembler-symbol identifier syntax;
- define values are integer or boolean in v1;
- setPc is optional;
- target CPU is fixed to 6510;
- output is fixed to C64 PRG/CBM format in v1.

There is no arbitrary ACME option list.

### Result: successful assembly

~~~json
{
  "assembled": true,
  "program": "<binary attachment>",
  "loadRange": {
    "start": "$0801",
    "end": "$24ff",
    "bytes": 7423
  },
  "symbols": [
    {
      "name": "update_player",
      "kind": "address",
      "address": "$2100",
      "used": true
    },
    {
      "name": "MAX_ENEMIES",
      "kind": "constant",
      "value": 8,
      "used": true
    }
  ],
  "diagnostics": []
}
~~~

symbol kind:

~~~text
address
constant
~~~

Structured symbols replace the need for the skill/LLM to parse ACME symbol/VICE-label files.

### Result: source errors

~~~json
{
  "assembled": false,
  "diagnostics": [
    {
      "severity": "error",
      "file": "main.a",
      "line": 42,
      "message": "..."
    }
  ]
}
~~~

A normal source error is not a Host Runtime infrastructure failure.

No program attachment is returned when assembled=false.

## 9. DXA facade

Logical operation:

~~~text
dxa.analyze
~~~

### Input

~~~json
{
  "image": "original/game.prg",
  "imageKind": "prg",
  "entryPoints": [
    "$2100",
    "$2300"
  ],
  "dataRanges": [
    {
      "start": "$3000",
      "end": "$30ff"
    }
  ],
  "labels": [
    {
      "address": "$2100",
      "name": "update_player"
    }
  ]
}
~~~

imageKind:

~~~text
prg
flat64k
~~~

Rules:

- image is a project-relative file;
- PRG load address comes from the PRG itself;
- flat64k represents a full $0000-$ffff image;
- entryPoints, dataRanges and labels are optional knowledge-derived seeds;
- callers provide arrays, not temporary DXA seed-file paths;
- the Host Runtime adapter creates whatever temporary DXA input files it needs.

Bounds:

- at most 1024 entry points;
- at most 1024 data ranges;
- at most 4096 labels.

### Result

~~~json
{
  "coverage": [
    {
      "start": "$0801",
      "end": "$9fff"
    }
  ],
  "regions": [
    {
      "start": "$2100",
      "end": "$217f",
      "classification": "code"
    },
    {
      "start": "$3000",
      "end": "$30ff",
      "classification": "data"
    }
  ],
  "labels": [
    {
      "address": "$2100",
      "name": "update_player"
    }
  ],
  "listing": "<text attachment>",
  "completeness": {
    "regions": true,
    "labels": false
  }
}
~~~

classification:

~~~text
code
data
~~~

completeness is private deterministic metadata used by the static-analysis adapter when deciding whether absence may retire older DXA-owned knowledge.

It is not normally shown to the LLM.

The c64-static-analysis script maps this DXA-specific result into the common normalized findings/import model.

The full listing is transient analysis material and is not automatically persisted in knowledge.db.

## 10. Ghidra facade

Logical operation:

~~~text
ghidra.analyze
~~~

### Input

~~~json
{
  "image": "original/game.prg",
  "imageKind": "prg",
  "entryPoints": [
    "$2100"
  ],
  "dataRanges": [
    {
      "start": "$3000",
      "end": "$30ff"
    }
  ],
  "labels": [
    {
      "address": "$2100",
      "name": "update_player"
    }
  ],
  "decompile": [
    "$2100"
  ]
}
~~~

imageKind:

~~~text
prg
flat64k
~~~

Rules:

- the C64/NMOS-6502 Ghidra language is fixed by the installation;
- caller does not provide processor/language IDs;
- caller does not provide loader names;
- caller does not provide run/project IDs;
- caller does not provide pre/post-script names or paths;
- caller does not provide output paths;
- vendored scripts and temporary Ghidra projects are Host Runtime implementation details;
- Ghidra projects are disposable per request;
- entryPoints, dataRanges and labels are optional current-knowledge seeds;
- decompile is an optional bounded list of routine entry addresses for transient immediate reasoning.

Bounds:

- at most 1024 entry points;
- at most 1024 data ranges;
- at most 4096 labels;
- at most 32 requested decompilations;
- decompiler text is bounded per function and in total.

### Result

~~~json
{
  "coverage": [
    {
      "start": "$0801",
      "end": "$9fff"
    }
  ],
  "functions": [
    {
      "entry": "$2100",
      "name": "update_player",
      "nameSource": "seed"
    },
    {
      "entry": "$2300",
      "name": "FUN_2300",
      "nameSource": "generated"
    }
  ],
  "regions": [
    {
      "start": "$2100",
      "end": "$217f",
      "classification": "code"
    }
  ],
  "references": [
    {
      "from": "$2110",
      "to": "$d000",
      "type": "write"
    },
    {
      "from": "$2120",
      "to": "$2300",
      "type": "call"
    }
  ],
  "decompilations": [
    {
      "entry": "$2100",
      "text": "..."
    }
  ],
  "completeness": {
    "functions": true,
    "regions": true,
    "references": true
  }
}
~~~

nameSource:

~~~text
seed
generated
native
~~~

reference type:

~~~text
call
jump
read
write
reference
~~~

The static-analysis script maps these Ghidra-specific structures into the normalized findings/import model.

A seed echoed back by Ghidra remains a seed; Ghidra does not become the owner of an existing semantic name merely by returning it.

Decompiler text is transient and never automatically imported into knowledge.db.

## 11. Analyzer atomicity

For both DXA and Ghidra:

~~~text
native execution
    ↓
collect complete native result
    ↓
parse/validate entire result
    ↓
return typed analyzer result
    ↓
local static-analysis adapter normalizes
    ↓
local knowledge importer reconciles
~~~

If native output is truncated, malformed or fails its self-consistency checks, the Host Runtime operation fails.

No partial analyzer result may be passed to the knowledge importer.

## 12. c1541 facade

Logical operation:

~~~text
c1541.inspect
~~~

One operation owns the disk-inspection/extraction actions:

~~~text
directory
bam
entry
chain
read
~~~

The caller never supplies a c1541 command string.

### Directory input

~~~json
{
  "action": "directory",
  "image": "original/game.d64"
}
~~~

### Directory result

~~~json
{
  "diskName": "GAME",
  "diskId": "01",
  "dosType": "2A",
  "freeBlocks": 512,
  "entries": [
    {
      "name": "GAME",
      "type": "prg",
      "blocks": 24,
      "closed": true,
      "locked": false
    }
  ]
}
~~~

type may include the normal CBM file types:

~~~text
del
seq
prg
usr
rel
unknown
~~~

### BAM input

~~~json
{
  "action": "bam",
  "image": "original/game.d64"
}
~~~

### BAM result

~~~json
{
  "tracks": [
    {
      "track": 1,
      "freeSectors": [
        0,
        2,
        4
      ],
      "usedSectors": [
        1,
        3
      ]
    }
  ]
}
~~~

### Entry input

~~~json
{
  "action": "entry",
  "image": "original/game.d64",
  "name": "GAME"
}
~~~

### Entry result

~~~json
{
  "found": true,
  "entry": {
    "name": "GAME",
    "type": "prg",
    "blocks": 24,
    "startTrack": 17,
    "startSector": 3,
    "closed": true,
    "locked": false
  }
}
~~~

A missing name is a valid domain-negative result:

~~~json
{
  "found": false
}
~~~

### Chain input

~~~json
{
  "action": "chain",
  "image": "original/game.d64",
  "name": "GAME"
}
~~~

### Chain result

~~~json
{
  "found": true,
  "sectors": [
    {
      "track": 17,
      "sector": 3
    },
    {
      "track": 17,
      "sector": 4
    }
  ]
}
~~~

### Read input

~~~json
{
  "action": "read",
  "image": "original/game.d64",
  "name": "GAME"
}
~~~

### Read result

~~~json
{
  "found": true,
  "name": "GAME",
  "data": "<binary attachment>"
}
~~~

No extraction destination path crosses to the host.

The calling disk skill decides where/if extracted bytes are written locally.

## 13. petcat facade

Logical operation:

~~~text
petcat.decode
~~~

### Input

~~~json
{
  "program": "original/loader.prg"
}
~~~

The dialect is fixed to C64 BASIC V2.

There is no caller-selected dialect or native option list.

### Result

~~~json
{
  "decoded": true,
  "listing": "10 SYS 2064\n...",
  "lines": [
    {
      "number": 10,
      "text": "SYS 2064"
    }
  ],
  "handoffs": [
    {
      "kind": "sys",
      "line": 10,
      "address": "$0810"
    }
  ]
}
~~~

If a SYS expression exists but cannot be resolved statically:

~~~json
{
  "kind": "sys",
  "line": 10,
  "computed": true
}
~~~

A valid BASIC program with no machine-code handoff returns an empty handoffs array.

petcat exit status alone is not sufficient evidence that decoding succeeded; the adapter validates the decoded result shape.

## 14. Native stdout/stderr

Raw stdout/stderr are never ordinary LLM-facing results.

The Host Runtime adapter may use them to:

- parse diagnostics;
- construct typed results;
- validate expected output;
- produce internal human diagnostics.

Relevant source-level diagnostics are converted into structured fields.

Tool logs may be retained in host diagnostics when useful, but are not returned merely because they exist.

## 15. Host-tool configuration

Native-tool location and prerequisite configuration are host concerns.

Examples:

~~~text
ACME installation/library
DXA installation
Ghidra installation/custom 6502 language
c1541/petcat installation supplied with or alongside VICE
~~~

A normal skill request does not carry configuration for these.

Missing configuration/tooling becomes an actionable tool-unavailable/installation-incomplete failure.

Ghidra extension/language installation is an installer/host-diagnostic responsibility, not a skill-callable analysis operation.

## 16. Security/confinement lessons retained from current code

The greenfield implementation should preserve the proven principles from the current host-tool seam:

- reject unknown request fields rather than silently dropping them;
- never pass raw caller argv to native tools;
- never spawn through a shell;
- confine all staged input/output to request-owned temporary roots;
- clear declared output locations before execution so stale files cannot masquerade as fresh success;
- require expected outputs/results before reporting success;
- bound every child process;
- kill request-owned children if the client/request disappears;
- never return host filesystem paths to the caller;
- transfer bytes separately from structured metadata when large/binary.

The implementation does not need to preserve the old control verbs, temporary-file names or transfer-handle shapes.

## 17. Relationship to skills

The skill layer remains small.

### c64-assembler

~~~text
project source
    ↓
acme.assemble
    ↓
structured diagnostics/symbols + program bytes
    ↓
write requested local output
~~~

### c64-static-analysis

~~~text
current local knowledge
    ↓
build analyzer seeds
    ↓
dxa.analyze / ghidra.analyze
    ↓
typed tool-specific result
    ↓
normalize findings locally
    ↓
import through local KnowledgeImporter
~~~

### c64-disk

~~~text
c1541.inspect
    ↓
interpret/request extraction
~~~

### c64-basic

~~~text
petcat.decode
    ↓
listing + machine-code handoff
~~~

No skill directly uses a host executable, host path, command line or temporary staging path.

## 18. What is deliberately absent

No v1 native-tool facade for:

- generic process execution;
- arbitrary ACME flags;
- arbitrary Ghidra scripts;
- persistent Ghidra projects;
- arbitrary c1541 commands;
- BASIC dialect selection;
- caller-selected native executable paths;
- caller-selected timeouts;
- knowledge.db access;
- direct VICE operations.

Those belong elsewhere or require a future concrete use case.
