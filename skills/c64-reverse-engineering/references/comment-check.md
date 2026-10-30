# Check of the comments

You check comments that another agent wrote about a C64 program. You did not write them. Find each claim that the evidence does not support.

## Inputs

- `sample.json`: the comments to check. Each item has `address`, `placement` and `text`. It has `name` when the address has a symbol.
- The project knowledge of the program: the listing, the references and the coverage.

## Procedure

1. Read the sample file.
2. For each item, read the listing of the code that the comment explains. Start at the address and stop at the end of the routine.
3. Read the references to the address. Read the access of each line in the coverage.
4. Find each claim of the comment. Check each claim against the code, the references and the coverage. Also check the name.
5. Give the item one verdict: `correct`, `wrong` or `unsure`.
6. Write the verdicts to `verdicts.json` in the folder of the sample file.

Do not change the project knowledge. Do not use other comments or the documentation as evidence. They can have the same errors.

## Verdicts

- `correct`: each claim agrees with the evidence.
- `wrong`: one or more claims do not agree with the evidence. Give the class of the error, the evidence and a correct text.
- `unsure`: the code and the coverage do not show the claim. Tell which run can show it.

A comment that does not give a detail is not wrong. A comment that tells more than the evidence shows is wrong.

## Error classes

| Class | Errors | Check |
|---|---|---|
| `callers` | "Only X calls it", "no code calls it", "each frame". | Read all references to the address: calls, jumps and the entries of address tables. For "each frame", find a path from the interrupt. |
| `bits` | A wrong bit number or mask. `AND #$7f` clears bit 7. Bit 0 is the lowest bit. | Write the mask in binary. |
| `registers` | A wrong register or flag, for example a result in X, not in A. | Follow each register and flag from the entry to each RTS. |
| `bounds` | A count or an end that is wrong by one. `LDX #$07`, `DEX`, `BPL` runs 8 times. | Count the loop. Find out if the end address is in the range. |
| `units` | Bytes and entries, frames and seconds, or pixels and characters in the wrong place. | Check the step of the index and the size of each element. |
| `paths` | A claim that is true on one path only. A branch with the wrong sense: `BCC` jumps when the carry is clear. | Read each branch to the end of the routine. |
| `tables` | A claim about all entries of a table that is true only for some entries. | Read all entries of the table in the listing. |
| `hardware` | A wrong meaning of a chip register, a ROM routine or a memory configuration. | Find the address in the memory map of the C64. |
| `place` | A comment that explains other code: the address is wrong, or the code changed. | Compare the comment with the code at its address. |
| `scope` | A claim of history, intent or a release that nobody examined. | Find the evidence of the claim. |

## The file of the verdicts

```json
{
  "seed": 4711,
  "revision": "20261030T150454.617-2o035m",
  "checked": 30,
  "wrong": 4,
  "unsure": 2,
  "items": [
    { "address": "$2100", "placement": "line", "verdict": "wrong", "class": "callers", "evidence": "JSR at $1f00 and $2400 call it.", "text": "Moves the player. The main loop and the demo mode call it." },
    { "address": "$2140", "placement": "side", "verdict": "correct" }
  ]
}
```

- `seed` and `revision` are the values of the sample file.
- `checked`, `wrong` and `unsure` are the counts of the items.
- Each item of the sample has one item in `items`.
- A `wrong` item has `class`, `evidence` and `text`. `text` is the correct comment.
- When the name is wrong, the item is `wrong` and has `name`: a correct name.
- An `unsure` item has `evidence`: the run that can show the claim.
