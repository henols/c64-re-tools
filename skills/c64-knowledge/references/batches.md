# Batches

This file gives the format of a batch for `apply` and `join`, and the rules of `join`. For the commands, see their sections of `SKILL.md`. `apply --help` also gives the fields of each op.

## Writes of a batch

A batch file is a JSON list of writes. Each write has `op` and the fields of the command with the same name. Each write can also have `space`. For example:

```json
[
  { "op": "rename", "address": "$2100", "name": "update_player", "kind": "routine" },
  { "op": "classify", "start": "$3000", "end": "$303b", "type": "bytes", "element": 6 },
  { "op": "comment", "address": "$2100", "placement": "line", "text": "Reads joystick 2." }
]
```

| op | Fields |
|---|---|
| `rename` | `address`, `name`, `kind` (optional) |
| `remove-symbol` | `address` |
| `classify` | `start`, `end`, `type`, `element` (optional) |
| `unclassify` | `start`, `end` |
| `comment` | `address`, `placement` (`line` or `side`), `text` |
| `uncomment` | `address`, `placement` |
| `reference`, `unreference` | `from`, `to`, `kind` |
| `module` | `start`, `file`, `title` (optional) |
| `unmodule` | `start` |
| `operand` | `address`, `select` (`lo`, `hi`, `value` or `expr`), `symbol` and `offset` (optional), or `expression` for `expr` |
| `unoperand` | `address` |
| `patch` | `start`, `end`, `switch`, `code` (empty for NOP only), `comment` (optional) |
| `unpatch` | `start`, `switch` (optional) |
| `macro` | `name`, `params` (a list or a comma list), `body`, `comment` (optional) |
| `unmacro` | `name` |
| `use` | `start`, `end`, `macro`, `args` (a list or a comma list) |
| `unuse` | `start` |

- The script checks an `operand`, `patch` or `use` write against the program of its space.

## Batches of parallel agents

When more agents name the program at the same time, give each agent one range of addresses. Each agent writes one batch file in `.c64-re-tools/local/` and does not apply it. A batch of an agent has the form `{"owner": {"start": "$1000", "end": "$1fff"}, "ops": [...]}`. `ops` holds the writes. The owner ranges must not overlap.

`join` makes one list of writes from the batches:

- At an address in the owner range of a batch, the name, the comment, the operand and the module of that batch stay. At an address that no batch owns, the first batch in the command stays.
- A batch can give an address a name that `join` replaces. Then `join` also replaces that name in the operand expressions and macro arguments of that batch.
- The regions of the owner come after the regions of the other batches. Thus the regions of the owner stay where they overlap.
- A name from a batch stays when another batch removes the symbol at that address.
