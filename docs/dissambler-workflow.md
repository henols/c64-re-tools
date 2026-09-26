
The strongest workflow is to use the three tools as **different analysis passes over the same binary**, with a neutral `analysis.json` between them.

```text
                 Original binary
                       │
                       ▼
              ┌─────────────────┐
              │ Normalization   │
              │ address mapping │
              │ entry points    │
              │ memory regions  │
              └────────┬────────┘
                       │
             ┌─────────▼─────────┐
             │       dxa         │
             │ discovery pass    │
             │                   │
             │ code/data         │
             │ routines          │
             │ address tables    │
             └─────────┬─────────┘
                       │ evidence
                       ▼
               ┌───────────────┐
               │ analysis.json │◄──────────────┐
               │               │               │
               │ canonical RE  │               │
               │ knowledge     │               │
               └───────┬───────┘               │
                       │ hints                  │
                       ▼                        │
              ┌─────────────────┐               │
              │ Ghidra Headless │               │
              │ semantic pass   │               │
              │                 │               │
              │ CFG             │               │
              │ xrefs           │               │
              │ functions       │               │
              │ data accesses   │               │
              │ types/arrays    │               │
              │ structures      │               │
              └────────┬────────┘               │
                       │ findings               │
                       └────────────────────────┘
                       │
                  analysis loop
                       │
                       ▼
               ┌───────────────┐
               │ da65 .info    │
               │ generator     │
               └───────┬───────┘
                       │
                       ▼
                    da65
                       │
                       ▼
                 clean source
                       │
                       ▼
                 ca65 + ld65
                       │
                       ▼
              reconstructed binary
                       │
                       ▼
              byte-for-byte compare
```

The key is that **dxa output, Ghidra's database, and da65's `.info` file are all derived artifacts**. Your own analysis model is authoritative.

## 1. Normalize the binary first

Before any disassembler runs, convert the input into a simple representation:

```text
input:
    game.prg

normalized:
    image.bin
    image.json
```

For example:

```json
{
  "sha256": "...",
  "cpu": "6502",
  "segments": [
    {
      "fileOffset": 0,
      "address": 2049,
      "size": 32768,
      "permissions": "rwx"
    }
  ],
  "entryPoints": [
    4096
  ]
}
```

This solves an important problem: every analyzer must agree that byte 0 of the normalized file corresponds to, say, `$0801`.

For ROMs with several mapped areas, banked ROMs, cartridges, etc., `segments` can contain several entries.

---

# 2. dxa performs the first discovery pass

dxa should initially know as little as possible:

```text
binary
load address
known entry point(s)
known data areas, if any
```

Its job is not naming things.

Its job is answering:

```text
Which bytes are probably executable?
Where are routine entry points?
Which areas look like data?
Are there likely address/dispatch tables?
```

dxa specifically supports address-table detection and recursive analysis, making it useful as the first pass. ([GSP Services][1])

Suppose it discovers:

```text
$1000-$1087    code
$1088-$10BF    data

$1100          routine
$1173          routine
$11E4          routine

$1400-$141F    probable address table

$1400 -> $1100
$1402 -> $1173
$1404 -> $11E4
```

Do **not** directly turn that into final source.

Instead convert it into evidence.

For example:

```json
{
  "regions": [
    {
      "start": 4096,
      "end": 4231,
      "kind": "code",
      "confidence": 0.8,
      "evidence": [
        {
          "source": "dxa",
          "reason": "recursive-code-scan"
        }
      ]
    }
  ],

  "tables": [
    {
      "address": 5120,
      "kind": "address-table",
      "elementSize": 2,
      "entries": 16,
      "confidence": 0.7,
      "evidence": [
        {
          "source": "dxa",
          "reason": "address-table-detector"
        }
      ]
    }
  ]
}
```

The actual confidence numbers are yours to define; the important point is storing **why** something was classified.

---

# 3. Feed dxa's findings into Ghidra

Now Ghidra doesn't start completely blind.

Generate a Ghidra pre-analysis script from `analysis.json`.

Conceptually:

```text
ApplyHints.java
```

would do things such as:

```text
mark $1000 as an entry point
mark $1100 as an entry point
mark $1173 as an entry point

create probable code at known code ranges

create probable pointer data at $1400

apply known labels

mark confirmed data ranges
```

Then invoke Ghidra headlessly.

Ghidra supports exactly this kind of pipeline:

```text
-preScript
    ↓
automatic analysis
    ↓
-postScript
```

from its headless analyzer. ([GitHub][2])

So conceptually:

```bash
analyzeHeadless ... \
    -import image.bin \
    -preScript ApplyHints.java analysis.json \
    -postScript ExportAnalysis.java ghidra.json
```

I would **not hard-code the processor language ID into your framework**; detect/configure it per installed Ghidra version.

---

# 4. Let Ghidra answer deeper questions

This is where Ghidra becomes much more useful than dxa.

After analysis, your `ExportAnalysis` script extracts information such as:

```text
functions
function boundaries

basic blocks

direct calls
indirect calls

incoming references
outgoing references

memory reads
memory writes

code references
data references

loops

candidate arrays

candidate pointer relationships

symbols

possible types
```

For example Ghidra might produce:

```text
Function $1173

called from:
    $1044
    $1062
    $1283

reads:
    $3200,X
    $3300,X

writes:
    $3400,X

X appears bounded by #$10
```

That is much more informative than:

```text
$1173 is executable
```

Now an analysis layer can infer:

```text
$3200 = probably array[16]
$3300 = probably array[16]
$3400 = probably array[16]
```

This is one of Ghidra's major contributions.

---

# 5. Add a semantic analysis layer

This could initially be ordinary deterministic code rather than AI.

Its job is to combine observations.

For example:

```text
Ghidra observes:

LDA $4000,X
STA $4100,X
LDA $4200,X

X always 0..31
```

Your analyzer can infer:

```json
{
  "tables": [
    {
      "address": 16384,
      "kind": "array",
      "elementSize": 1,
      "count": 32
    },
    {
      "address": 16640,
      "kind": "array",
      "elementSize": 1,
      "count": 32
    }
  ]
}
```

Or suppose it sees:

```asm
lda table_lo,x
sta ptr
lda table_hi,x
sta ptr+1
jmp (ptr)
```

It can infer:

```text
table_lo + table_hi
    =
split pointer dispatch table
```

That is something neither dxa nor da65 represents automatically especially well.

Your canonical model could represent it as:

```json
{
  "tables": [
    {
      "name": "command_handlers",
      "kind": "split-address-table",
      "lowBytes": 8192,
      "highBytes": 8224,
      "count": 32,
      "targetKind": "code"
    }
  ]
}
```

This is much richer than either tool's native format.

---

# 6. Structures can be inferred here too

This is where Ghidra becomes particularly interesting.

Suppose multiple routines do:

```asm
lda $5000,x
lda $5001,x
lda $5002,x
lda $5003,x

txa
clc
adc #4
tax
```

Your analysis can hypothesize:

```c
struct Object {
    uint8_t type;
    uint8_t x;
    uint8_t y;
    uint8_t flags;
};
```

with:

```text
object size = 4
```

You store:

```json
{
  "structures": [
    {
      "name": "Object",
      "size": 4,
      "confidence": 0.75,
      "fields": [
        {"offset": 0, "size": 1, "name": "type"},
        {"offset": 1, "size": 1, "name": "x"},
        {"offset": 2, "size": 1, "name": "y"},
        {"offset": 3, "size": 1, "name": "flags"}
      ]
    }
  ]
}
```

Initially the names might simply be:

```text
field_0
field_1
field_2
field_3
```

and get renamed as evidence accumulates.

Ghidra can receive that type back on the **next iteration**, improving subsequent analysis.

That creates an important feedback loop:

```text
infer structure
      ↓
apply structure to Ghidra
      ↓
reanalyze
      ↓
better references
      ↓
better understanding
```

---

# 7. Keep facts and hypotheses separate

I strongly recommend distinguishing:

```text
CONFIRMED
PROBABLE
SPECULATIVE
USER_OVERRIDE
```

For example:

```json
{
  "address": 20480,
  "kind": "array",
  "confidence": 0.92,

  "evidence": [
    {
      "source": "ghidra",
      "type": "indexed-access",
      "function": 4371
    },
    {
      "source": "ghidra",
      "type": "indexed-access",
      "function": 5122
    },
    {
      "source": "dxa",
      "type": "data-region"
    }
  ]
}
```

If three unrelated routines all access `$5000,X` with X ranging from 0–15, the array hypothesis becomes strong.

That is much safer than allowing either Ghidra or an LLM to declare:

> `$5000` is an enemy table.

without recording the evidence.

---

# 8. Feed improved knowledge back into dxa

dxa doesn't necessarily need to run only once.

After Ghidra analysis you may know:

```text
$2800-$28FF definitely data

$3000 definitely code

$3100 definitely code

JSR $4300 has inline data

$4000-$403F is an address table
```

Generate a new dxa invocation/hints.

Now its recursive scanner should no longer accidentally consume those data areas as code.

You get:

```text
dxa pass 1
      ↓
Ghidra
      ↓
merged knowledge
      ↓
dxa pass 2
      ↓
better code/data map
```

Usually this should converge fairly quickly.

---

# 9. da65 comes late in the workflow

I would not use da65 as an analysis engine early on.

Instead it becomes your **source-generation backend**.

Generate:

```text
generated/program.info
```

from `analysis.json`.

For example:

```text
RANGE {
    START $4000;
    END   $403F;
    TYPE AddrTable;
    NAME "command_handlers";
};

RANGE {
    START $5000;
    END   $501F;
    TYPE ByteTable;
    NAME "object_types";
};
```

da65 explicitly supports information files containing labels, ranges and table/data descriptions and emits source intended for ca65. ([cc65][3])

For inline arguments:

```asm
jsr Print
.byte "HELLO",0
```

the canonical model might contain:

```json
{
  "function": 18432,
  "inlineParameterSize": 6
}
```

and your generator turns that into the appropriate da65 `PARAMSIZE` information. da65 has explicit support for this construct. ([cc65][3])

---

# 10. Use da65 output as generated source

I would keep this separation:

```text
analysis/
    analysis.json

generated/
    program.info
    program.s
```

Never manually edit:

```text
program.info
program.s
```

because they're generated.

If you discover:

```text
$1173 = UpdateEnemies
```

change:

```text
analysis.json
```

or preferably a human override file such as:

```text
overrides.yaml
```

Then regenerate everything.

---

# 11. Build the disassembly

da65 emits source for ca65. ([cc65][3])

So:

```text
program.s
   │
   ▼
 ca65
   │
 object
   │
   ▼
 ld65
   │
   ▼
 rebuilt.bin
```

A generated linker configuration establishes the original memory layout.

For something simple this could amount to:

```text
$0801-$9FFF -> original binary segment
```

For cartridges/ROMs it may be multiple regions.

---

# 12. Binary identity is an independent validation

Then:

```bash
cmp original.bin rebuilt.bin
```

or hash both files.

A byte-perfect result proves:

```text
disassembly → assembly
```

is lossless.

It does **not** prove that:

```text
monster_table
```

really contains monsters.

That's why you should treat:

```text
binary correctness
```

and:

```text
semantic correctness
```

as two separate validation dimensions.

---

# The iterative pipeline

I would implement the actual pipeline as:

```text
PASS 0
Normalize binary
      │
      ▼
PASS 1
dxa discovery
      │
      ▼
Merge into analysis.json
      │
      ▼
PASS 2
Ghidra pre-script
      │
      ▼
Ghidra auto analysis
      │
      ▼
Ghidra post-script
      │
      ▼
Merge functions/xrefs/accesses
      │
      ▼
PASS 3
Structural analysis
      │
      ├── arrays
      ├── pointer tables
      ├── split pointer tables
      ├── dispatch tables
      ├── record sizes
      ├── strings
      └── inline parameters
      │
      ▼
analysis.json
      │
      ├─────────────┐
      │             │
      ▼             ▼
new dxa hints    new Ghidra hints
      │             │
      └──────┬──────┘
             │
          repeat
             │
             ▼
stable analysis
             │
             ▼
generate da65.info
             │
             ▼
da65
             │
             ▼
ca65/ld65
             │
             ▼
binary comparison
```

## A practical project layout

I'd structure the implementation approximately like this:

```text
reproject/
│
├── input/
│   └── original.prg
│
├── image/
│   ├── image.bin
│   └── image.json
│
├── analysis/
│   ├── model.json
│   ├── overrides.yaml
│   │
│   └── evidence/
│       ├── dxa.json
│       ├── ghidra.json
│       └── structural.json
│
├── ghidra/
│   ├── ApplyHints.java
│   └── ExportAnalysis.java
│
├── tools/
│   ├── run_dxa.py
│   ├── merge_analysis.py
│   ├── infer_tables.py
│   ├── generate_da65.py
│   └── verify.py
│
├── generated/
│   ├── program.info
│   ├── program.s
│   ├── linker.cfg
│   └── rebuilt.bin
│
└── run.py
```

Then the entire thing becomes:

```bash
python run.py analyze game.prg
```

and internally:

```text
normalize
→ dxa
→ merge
→ Ghidra
→ merge
→ structural inference
→ repeat until stable
→ da65
→ ca65/ld65
→ compare
```

### One addition I would make eventually

Add an optional **dynamic evidence source**, particularly for self-modifying, packed or relocated 6502 code:

```text
VICE / another 6502 emulator
          │
          ├── executed addresses
          ├── memory writes
          ├── indirect jumps
          └── runtime-created code
          │
          ▼
     analysis.json
```

Then an address actually executed by the CPU can be considered much stronger evidence of `CODE` than static heuristics alone.

That would make the architecture particularly robust:

**dxa discovers, Ghidra understands, dynamic tracing verifies runtime behavior, da65 reconstructs.**

The next thing I would design before writing any integration code is the **`analysis.json` schema**, because that determines whether these components remain cleanly interchangeable or become tightly coupled to Ghidra/da65.

[1]: https://www.gsp.com/cgi-bin/man.cgi?section=1&topic=dxa&utm_source=chatgpt.com "DXA(1) - 6502/R65C02 disassembler"
[2]: https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md?utm_source=chatgpt.com "ghidra/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md at master · NationalSecurityAgency/ghidra · GitHub"
[3]: https://cc65.github.io/doc/da65.html?utm_source=chatgpt.com "da65 Users Guide"

---

Yes. Below is a fairly complete **Python-like pseudocode implementation** of the entire pipeline. It is deliberately close to real Python so it can later be turned into an actual program.

The key design rule is:

```text
analysis/model.json = source of truth

dxa        = discovery engine
Ghidra     = semantic analysis engine
da65       = source generator
ca65/ld65  = reconstruction
emulator   = optional runtime evidence
```

```python
#!/usr/bin/env python3

# ============================================================
# 6502 AUTOMATED REVERSE ENGINEERING PIPELINE
#
# Input:
#     binary / PRG / ROM
#
# Output:
#     analysis/model.json
#     generated/program.info
#     generated/program.s
#     generated/rebuilt.bin
#     reports/verification.json
#
# Pipeline:
#
#   normalize
#      ↓
#   dxa
#      ↓
#   merge evidence
#      ↓
#   Ghidra
#      ↓
#   merge evidence
#      ↓
#   structural inference
#      ↓
#   optional dynamic tracing
#      ↓
#   iterate until stable
#      ↓
#   generate da65 metadata
#      ↓
#   da65
#      ↓
#   ca65 + ld65
#      ↓
#   byte-perfect verification
#
# ============================================================


# ------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------

CONFIG = {

    "input": {
        "file": "input/program.prg",

        # auto | prg | raw | rom
        "format": "auto",

        # Required for raw binaries.
        "load_address": None,

        # Optional known entry points.
        "entry_points": [
            # 0x1000
        ],
    },

    "cpu": {
        "type": "6502",

        # dxa should use full NMOS instruction set.
        "undocumented_opcodes": True,
    },

    "analysis": {

        # Repeat dxa/Ghidra/inference until nothing important changes.
        "max_passes": 10,

        # Stop when model changes fall below this threshold.
        "convergence_threshold": 0,

        # Minimum confidence before information is exported to tools.
        "apply_hint_confidence": 0.70,

        # Minimum confidence before data becomes final da65 metadata.
        "source_generation_confidence": 0.85,

        "run_dynamic_trace": False,
    },

    "tools": {
        "dxa": "/usr/local/bin/dxa",

        "ghidra_headless":
            "/opt/ghidra/support/analyzeHeadless",

        "ghidra_project_dir":
            "work/ghidra",

        "da65": "/usr/bin/da65",
        "ca65": "/usr/bin/ca65",
        "ld65": "/usr/bin/ld65",

        # Optional
        "emulator": "/usr/bin/x64sc",
    }
}


# ============================================================
# CANONICAL ANALYSIS DATABASE
# ============================================================

def create_empty_model():

    return {

        "image": {
            "sha256": None,
            "size": 0,

            "segments": []
        },

        "entry_points": [],

        "regions": [],
        # {
        #   start: 0x1000,
        #   end:   0x10ff,
        #   kind:  "code" | "data" | "unknown",
        #   confidence: 0.95,
        #   evidence: [...]
        # }

        "functions": [],
        # {
        #   address: 0x1200,
        #   end: 0x1240,
        #   name: "function_1200",
        #   confidence: 0.9,
        #
        #   callers: [],
        #   callees: [],
        #
        #   reads: [],
        #   writes: [],
        #
        #   evidence: [...]
        # }

        "tables": [],
        # {
        #   address: 0x3000,
        #
        #   kind:
        #       byte-table
        #       word-table
        #       address-table
        #       split-address-table
        #       rts-table
        #       text-table
        #       array
        #
        #   element_size: 2,
        #   count: 16,
        #
        #   confidence: 0.9,
        #
        #   evidence: [...]
        # }

        "structures": [],
        # {
        #   name: "Object",
        #   size: 5,
        #
        #   fields: [
        #       { offset:0, size:1, name:"field_0" },
        #       ...
        #   ],
        #
        #   confidence: 0.75
        # }

        "symbols": [],
        # {
        #   address: 0xd020,
        #   name: "VIC_BORDER",
        #   type: "hardware"
        # }

        "references": [],
        # {
        #   from: 0x1040,
        #   to:   0x3000,
        #   type: "read" | "write" | "call" | "jump"
        # }

        "inline_parameters": [],
        # {
        #   function: 0x4000,
        #   size: 3
        # }

        "conflicts": [],

        "statistics": {
            "analysis_passes": 0
        }
    }


# ============================================================
# MAIN
# ============================================================

def main():

    create_directories()

    # --------------------------------------------------------
    # PASS 0
    # Normalize input
    # --------------------------------------------------------

    model = create_empty_model()

    image = normalize_input(
        CONFIG["input"]
    )

    model["image"] = image.metadata

    add_initial_entry_points(
        model,
        CONFIG["input"]["entry_points"]
    )

    save_model(model)


    # --------------------------------------------------------
    # ITERATIVE STATIC ANALYSIS
    # --------------------------------------------------------

    for pass_number in range(
        1,
        CONFIG["analysis"]["max_passes"] + 1
    ):

        print(
            "============================================"
        )

        print(
            f"ANALYSIS PASS {pass_number}"
        )

        print(
            "============================================"
        )


        model_before = deep_copy(model)


        # ====================================================
        # DXA DISCOVERY
        # ====================================================

        dxa_hints = build_dxa_hints(
            model,
            minimum_confidence =
                CONFIG["analysis"]["apply_hint_confidence"]
        )

        dxa_output = run_dxa(
            binary=image.binary_file,
            load_address=image.base_address,
            entry_points=get_entry_points(model),
            hints=dxa_hints,
            undocumented_opcodes=True
        )

        dxa_evidence = parse_dxa_output(
            dxa_output
        )

        save_json(
            f"analysis/evidence/dxa-pass-{pass_number}.json",
            dxa_evidence
        )

        merge_evidence(
            model,
            dxa_evidence,
            source="dxa"
        )


        # ====================================================
        # GHIDRA SEMANTIC ANALYSIS
        # ====================================================

        ghidra_hints = build_ghidra_hints(
            model,
            minimum_confidence =
                CONFIG["analysis"]["apply_hint_confidence"]
        )

        save_json(
            "work/ghidra-hints.json",
            ghidra_hints
        )


        run_ghidra_headless(
            binary=image.binary_file,

            base_address=image.base_address,

            hints_file=
                "work/ghidra-hints.json",

            output_file=
                "work/ghidra-analysis.json"
        )


        ghidra_evidence = load_json(
            "work/ghidra-analysis.json"
        )


        save_json(
            f"analysis/evidence/ghidra-pass-{pass_number}.json",
            ghidra_evidence
        )


        merge_evidence(
            model,
            ghidra_evidence,
            source="ghidra"
        )


        # ====================================================
        # OUR OWN STRUCTURAL ANALYSIS
        # ====================================================

        structural_evidence = \
            infer_structures_and_tables(
                model,
                image
            )


        save_json(
            f"analysis/evidence/structural-pass-{pass_number}.json",
            structural_evidence
        )


        merge_evidence(
            model,
            structural_evidence,
            source="structural-analyzer"
        )


        # ====================================================
        # OPTIONAL DYNAMIC ANALYSIS
        # ====================================================

        if CONFIG["analysis"]["run_dynamic_trace"]:

            runtime_evidence = run_dynamic_analysis(
                image,
                model
            )

            merge_evidence(
                model,
                runtime_evidence,
                source="runtime"
            )


        # ====================================================
        # RESOLVE CONFLICTS
        # ====================================================

        resolve_conflicts(
            model
        )


        # ====================================================
        # PROPAGATE NEW INFORMATION
        # ====================================================

        propagate_knowledge(
            model
        )


        # Examples:
        #
        # address table target
        #     ↓
        # new probable function
        #
        # function executed at runtime
        #     ↓
        # confirmed code
        #
        # pointer referenced by JMP()
        #     ↓
        # probable dispatch table


        model["statistics"]["analysis_passes"] = \
            pass_number


        save_model(model)


        # ====================================================
        # CONVERGENCE
        # ====================================================

        changes = compare_models(
            model_before,
            model
        )


        print(
            f"Model changes: {changes}"
        )


        if changes <= \
           CONFIG["analysis"]["convergence_threshold"]:

            print(
                "Analysis converged."
            )

            break


    # --------------------------------------------------------
    # HUMAN OVERRIDES
    # --------------------------------------------------------

    if file_exists(
        "analysis/overrides.yaml"
    ):

        apply_overrides(
            model,
            "analysis/overrides.yaml"
        )

        save_model(model)


    # --------------------------------------------------------
    # GENERATE DA65 METADATA
    # --------------------------------------------------------

    generate_da65_info(
        model=model,

        output=
            "generated/program.info",

        minimum_confidence=
            CONFIG["analysis"]
                  ["source_generation_confidence"]
    )


    # --------------------------------------------------------
    # GENERATE ASSEMBLY
    # --------------------------------------------------------

    run_da65(
        binary=image.binary_file,

        info_file=
            "generated/program.info",

        output=
            "generated/program.s"
    )


    # --------------------------------------------------------
    # GENERATE LINKER CONFIGURATION
    # --------------------------------------------------------

    generate_ld65_config(
        model,
        image,
        "generated/linker.cfg"
    )


    # --------------------------------------------------------
    # ASSEMBLE
    # --------------------------------------------------------

    run_ca65(
        source=
            "generated/program.s",

        object_file=
            "generated/program.o"
    )


    # --------------------------------------------------------
    # LINK
    # --------------------------------------------------------

    run_ld65(
        object_file=
            "generated/program.o",

        linker_config=
            "generated/linker.cfg",

        output=
            "generated/rebuilt.bin"
    )


    # --------------------------------------------------------
    # VERIFY
    # --------------------------------------------------------

    verification = verify_binary(
        original=image.binary_file,
        rebuilt="generated/rebuilt.bin"
    )


    save_json(
        "reports/verification.json",
        verification
    )


    if verification["identical"]:

        print(
            "SUCCESS: byte-perfect reconstruction."
        )

    else:

        print(
            "FAILURE: reconstructed binary differs."
        )

        generate_binary_difference_report(
            image.binary_file,
            "generated/rebuilt.bin",
            "reports/binary-diff.txt"
        )


# ============================================================
# INPUT NORMALIZATION
# ============================================================

def normalize_input(input_config):

    filename = input_config["file"]

    raw = read_binary(filename)

    format = detect_format(
        filename,
        raw,
        input_config["format"]
    )


    if format == "prg":

        load_address = (
            raw[0]
            |
            raw[1] << 8
        )

        binary = raw[2:]


    elif format == "raw":

        load_address = \
            input_config["load_address"]

        require(
            load_address is not None,
            "Raw binary requires load address"
        )

        binary = raw


    elif format == "rom":

        load_address = \
            input_config["load_address"]

        binary = raw


    write_binary(
        "image/image.bin",
        binary
    )


    metadata = {

        "sha256":
            sha256(binary),

        "size":
            len(binary),

        "segments": [
            {
                "file_offset": 0,

                "address":
                    load_address,

                "size":
                    len(binary),

                "permissions":
                    "rwx"
            }
        ]
    }


    return NormalizedImage(
        binary_file=
            "image/image.bin",

        base_address=
            load_address,

        metadata=
            metadata
    )


# ============================================================
# DXA
# ============================================================

def build_dxa_hints(
    model,
    minimum_confidence
):

    hints = {

        "code": [],
        "data": [],
        "entry_points": []
    }


    for region in model["regions"]:

        if region["confidence"] < \
           minimum_confidence:

            continue


        if region["kind"] == "code":

            hints["code"].append(
                [
                    region["start"],
                    region["end"]
                ]
            )


        elif region["kind"] == "data":

            hints["data"].append(
                [
                    region["start"],
                    region["end"]
                ]
            )


    for function in model["functions"]:

        if function["confidence"] >= \
           minimum_confidence:

            hints["entry_points"].append(
                function["address"]
            )


    return hints


def run_dxa(
    binary,
    load_address,
    entry_points,
    hints,
    undocumented_opcodes
):

    command = [
        CONFIG["tools"]["dxa"]
    ]


    #
    # TRANSLATE CANONICAL SETTINGS
    # INTO THE ACTUAL DXA CLI FLAGS HERE.
    #
    # Example concepts:
    #
    # CPU = all NMOS 6502 instructions
    # load address
    # known routine entry points
    # forced data ranges
    # address table detection
    #


    command += dxa_cpu_arguments(
        undocumented_opcodes
    )

    command += dxa_load_arguments(
        load_address
    )

    command += dxa_entry_arguments(
        entry_points
    )

    command += dxa_hint_arguments(
        hints
    )

    command += dxa_address_table_detection()


    command.append(
        binary
    )


    return execute(
        command
    )


def parse_dxa_output(output):

    evidence = {

        "regions": [],
        "functions": [],
        "tables": [],
        "references": []
    }


    parsed = parse_dxa_listing(
        output
    )


    for code_region in parsed.code_regions:

        evidence["regions"].append({

            "start":
                code_region.start,

            "end":
                code_region.end,

            "kind":
                "code",

            "confidence":
                0.80,

            "reason":
                "recursive-code-scan"
        })


    for routine in parsed.routines:

        evidence["functions"].append({

            "address":
                routine.address,

            "confidence":
                0.80,

            "reason":
                "dxa-routine-discovery"
        })


    for table in parsed.address_tables:

        evidence["tables"].append({

            "address":
                table.address,

            "kind":
                "address-table",

            "element_size":
                2,

            "count":
                table.count,

            "targets":
                table.targets,

            "confidence":
                0.75
        })


    return evidence


# ============================================================
# GHIDRA
# ============================================================

def build_ghidra_hints(
    model,
    minimum_confidence
):

    return {

        "entry_points":
            [
                f["address"]
                for f in model["functions"]
                if f["confidence"] >=
                   minimum_confidence
            ],

        "regions":
            [
                r
                for r in model["regions"]
                if r["confidence"] >=
                   minimum_confidence
            ],

        "tables":
            [
                t
                for t in model["tables"]
                if t["confidence"] >=
                   minimum_confidence
            ],

        "symbols":
            model["symbols"],

        "structures":
            [
                s
                for s in model["structures"]
                if s["confidence"] >=
                   minimum_confidence
            ]
    }


def run_ghidra_headless(
    binary,
    base_address,
    hints_file,
    output_file
):

    project_name = "analysis"


    command = [

        CONFIG["tools"]["ghidra_headless"],

        CONFIG["tools"]["ghidra_project_dir"],

        project_name,

        "-import",
        binary,

        #
        # Select correct installed 6502
        # language/processor configuration.
        #

        "-preScript",
        "ApplyHints.java",
        hints_file,

        "-postScript",
        "ExportAnalysis.java",
        output_file
    ]


    execute(
        command
    )


# ------------------------------------------------------------
# GHIDRA ApplyHints concept
# ------------------------------------------------------------

def ghidra_apply_hints(hints):

    for entry in hints["entry_points"]:

        create_instruction_at(
            entry
        )

        create_function_at(
            entry
        )


    for region in hints["regions"]:

        if region["kind"] == "code":

            mark_as_code(
                region["start"],
                region["end"]
            )

        elif region["kind"] == "data":

            mark_as_data(
                region["start"],
                region["end"]
            )


    for table in hints["tables"]:

        if table["kind"] == \
           "address-table":

            create_pointer_array(
                table["address"],
                table["count"]
            )


    for structure in hints["structures"]:

        create_ghidra_structure(
            structure
        )


# ------------------------------------------------------------
# GHIDRA ExportAnalysis concept
# ------------------------------------------------------------

def ghidra_export_analysis():

    result = {

        "functions": [],
        "references": [],
        "regions": [],
        "tables": [],
        "data_accesses": []
    }


    for function in ghidra_functions():

        result["functions"].append({

            "address":
                function.start,

            "end":
                function.end,

            "callers":
                find_callers(function),

            "callees":
                find_callees(function),

            "reads":
                find_memory_reads(function),

            "writes":
                find_memory_writes(function),

            "basic_blocks":
                export_basic_blocks(function),

            "confidence":
                0.90
        })


    for reference in ghidra_references():

        result["references"].append({

            "from":
                reference.source,

            "to":
                reference.destination,

            "type":
                reference.type,

            "confidence":
                0.90
        })


    write_json(
        POST_SCRIPT_OUTPUT_FILE,
        result
    )


# ============================================================
# STRUCTURAL ANALYSIS
# ============================================================

def infer_structures_and_tables(
    model,
    image
):

    evidence = {

        "tables": [],
        "structures": [],
        "functions": []
    }


    infer_normal_pointer_tables(
        model,
        image,
        evidence
    )


    infer_split_pointer_tables(
        model,
        image,
        evidence
    )


    infer_indexed_arrays(
        model,
        evidence
    )


    infer_record_arrays(
        model,
        evidence
    )


    infer_dispatch_tables(
        model,
        evidence
    )


    infer_inline_parameters(
        model,
        image,
        evidence
    )


    infer_strings(
        model,
        image,
        evidence
    )


    return evidence


# ============================================================
# POINTER TABLE DETECTION
# ============================================================

def infer_normal_pointer_tables(
    model,
    image,
    evidence
):

    for data_region in \
        probable_data_regions(model):

        values = read_words(
            image,
            data_region
        )


        valid_targets = 0


        for value in values:

            if address_inside_image(
                model,
                value
            ):

                valid_targets += 1


        ratio = \
            valid_targets / len(values)


        if ratio > 0.80:

            evidence["tables"].append({

                "address":
                    data_region["start"],

                "kind":
                    "address-table",

                "element_size":
                    2,

                "count":
                    len(values),

                "targets":
                    values,

                "confidence":
                    0.70 + 0.25 * ratio,

                "reason":
                    "majority-values-valid-addresses"
            })


# ============================================================
# SPLIT POINTER TABLE DETECTION
# ============================================================

def infer_split_pointer_tables(
    model,
    image,
    evidence
):

    #
    # Search for patterns such as:
    #
    # LDA table_lo,X
    # STA ptr
    #
    # LDA table_hi,X
    # STA ptr+1
    #
    # JMP (ptr)
    #
    # Or:
    #
    # LDA table_hi,X
    # PHA
    # LDA table_lo,X
    # PHA
    # RTS
    #


    for function in model["functions"]:

        patterns = analyze_instruction_patterns(
            function
        )


        for pattern in patterns:

            if pattern.type == \
               "split-pointer-access":

                evidence["tables"].append({

                    "kind":
                        "split-address-table",

                    "low_bytes":
                        pattern.low_table,

                    "high_bytes":
                        pattern.high_table,

                    "count":
                        pattern.count,

                    "target_kind":
                        pattern.target_kind,

                    "confidence":
                        0.90,

                    "reason":
                        "6502-split-pointer-pattern"
                })


# ============================================================
# ARRAY DETECTION
# ============================================================

def infer_indexed_arrays(
    model,
    evidence
):

    #
    # Example:
    #
    # LDA $4000,X
    #
    # where analysis proves:
    #
    #     X = 0..31
    #
    # gives:
    #
    #     $4000 = byte[32]
    #


    accesses = group_indexed_accesses(
        model["functions"]
    )


    for access in accesses:

        if access.index_register not in [
            "X",
            "Y"
        ]:
            continue


        bounds = infer_index_bounds(
            access
        )


        if bounds.confidence < 0.70:
            continue


        evidence["tables"].append({

            "address":
                access.base_address,

            "kind":
                "array",

            "element_size":
                access.element_size,

            "count":
                bounds.maximum + 1,

            "confidence":
                min(
                    access.confidence,
                    bounds.confidence
                ),

            "reason":
                "indexed-memory-access"
        })


# ============================================================
# STRUCTURE / RECORD DETECTION
# ============================================================

def infer_record_arrays(
    model,
    evidence
):

    #
    # Look for repeated accesses:
    #
    # base + 0
    # base + 1
    # base + 2
    # base + 3
    #
    # combined with:
    #
    # index += 4
    #
    # Possible:
    #
    # struct size = 4
    #


    for function in model["functions"]:

        patterns = \
            find_repeated_offset_accesses(
                function
            )


        for pattern in patterns:

            stride = \
                infer_iteration_stride(
                    function,
                    pattern
                )


            if stride is None:
                continue


            if stride < 2:
                continue


            fields = []


            for offset in \
                pattern.accessed_offsets:

                fields.append({

                    "offset":
                        offset,

                    "size":
                        1,

                    "name":
                        f"field_{offset}"
                })


            evidence[
                "structures"
            ].append({

                "name":
                    f"struct_{pattern.base_address:04X}",

                "base_address":
                    pattern.base_address,

                "size":
                    stride,

                "fields":
                    fields,

                "confidence":
                    0.70,

                "reason":
                    "repeated-strided-access"
            })


# ============================================================
# DISPATCH TABLES
# ============================================================

def infer_dispatch_tables(
    model,
    evidence
):

    for table in model["tables"]:

        if table["kind"] not in [
            "address-table",
            "split-address-table"
        ]:

            continue


        references = \
            references_to_table(
                model,
                table
            )


        for ref in references:

            function = \
                function_containing(
                    model,
                    ref["from"]
                )


            if function is None:
                continue


            if function_contains_indirect_jump(
                function
            ):

                evidence["tables"].append({

                    **table,

                    "kind":
                        "dispatch-table",

                    "target_kind":
                        "code",

                    "confidence":
                        0.95,

                    "reason":
                        "pointer-table-feeds-indirect-jump"
                })


# ============================================================
# KNOWLEDGE PROPAGATION
# ============================================================

def propagate_knowledge(
    model
):

    #
    # Address-table targets
    # may be new function entry points.
    #

    for table in model["tables"]:

        if table.get(
            "target_kind"
        ) != "code":

            continue


        for target in \
            table.get("targets", []):

            add_function_hypothesis(
                model,

                address=target,

                confidence=
                    table["confidence"] * 0.95,

                evidence={
                    "source":
                        "knowledge-propagation",

                    "reason":
                        "code-pointer-table"
                }
            )


    #
    # CALL targets are executable.
    #

    for reference in model["references"]:

        if reference["type"] == "call":

            add_function_hypothesis(
                model,

                address=
                    reference["to"],

                confidence=
                    0.98,

                evidence={
                    "reason":
                        "direct-call-target"
                }
            )


# ============================================================
# EVIDENCE MERGING
# ============================================================

def merge_evidence(
    model,
    evidence,
    source
):

    for category in [

        "regions",
        "functions",
        "tables",
        "structures",
        "references"

    ]:

        for item in \
            evidence.get(category, []):

            item["evidence"] = \
                item.get(
                    "evidence",
                    []
                )


            item["evidence"].append({

                "source":
                    source,

                "reason":
                    item.get(
                        "reason",
                        "unspecified"
                    )
            })


            merge_item(
                model[category],
                item
            )


# ============================================================
# CONFIDENCE MERGING
# ============================================================

def merge_confidence(
    existing,
    new
):

    #
    # Example combination:
    #
    # dxa says code 0.80
    # Ghidra says code 0.90
    #
    # Combined probability:
    #
    # 1 - (1-.8)*(1-.9)
    #
    # = .98
    #


    return 1 - (
        (1 - existing)
        *
        (1 - new)
    )


# ============================================================
# CONFLICT HANDLING
# ============================================================

def resolve_conflicts(
    model
):

    #
    # Example:
    #
    # DXA:
    #
    # $2000-$20ff = code
    #
    # Ghidra:
    #
    # $2000-$20ff = data
    #
    # Never silently choose.
    #


    overlaps = \
        find_conflicting_regions(
            model["regions"]
        )


    for conflict in overlaps:

        model["conflicts"].append({

            "start":
                conflict.start,

            "end":
                conflict.end,

            "interpretations":
                conflict.interpretations
        })


# ============================================================
# DYNAMIC ANALYSIS
# ============================================================

def run_dynamic_analysis(
    image,
    model
):

    #
    # Optional future module.
    #
    # Emulator produces:
    #
    # executed PC addresses
    # memory reads
    # memory writes
    # indirect jumps
    # self-modifying writes
    #
    # Runtime execution is extremely strong evidence
    # that an address is CODE.
    #


    trace = run_emulator_with_trace(
        image
    )


    evidence = {

        "regions": [],
        "functions": [],
        "references": []
    }


    for address in \
        trace.executed_addresses:

        evidence["regions"].append({

            "start":
                address,

            "end":
                address,

            "kind":
                "code",

            "confidence":
                1.0,

            "reason":
                "executed-at-runtime"
        })


    return evidence


# ============================================================
# DA65 GENERATION
# ============================================================

def generate_da65_info(
    model,
    output,
    minimum_confidence
):

    text = ""


    # --------------------------------------------------------
    # CODE
    # --------------------------------------------------------

    for region in model["regions"]:

        if region["confidence"] < \
           minimum_confidence:

            continue


        if region["kind"] != "code":
            continue


        text += """

RANGE {
    START $%04X;
    END   $%04X;
    TYPE CODE;
};

""" % (
            region["start"],
            region["end"]
        )


    # --------------------------------------------------------
    # TABLES
    # --------------------------------------------------------

    for table in model["tables"]:

        if table["confidence"] < \
           minimum_confidence:

            continue


        da65_type = \
            canonical_table_to_da65(
                table
            )


        if da65_type is None:
            continue


        start = \
            table["address"]


        end = (
            start
            +
            table["element_size"]
            *
            table["count"]
            -
            1
        )


        text += """

RANGE {
    START $%04X;
    END   $%04X;
    TYPE %s;
};

""" % (
            start,
            end,
            da65_type
        )


    # --------------------------------------------------------
    # SYMBOLS
    # --------------------------------------------------------

    for symbol in model["symbols"]:

        text += generate_da65_label(
            symbol
        )


    write_text(
        output,
        text
    )


def canonical_table_to_da65(
    table
):

    mapping = {

        "byte-table":
            "BYTETABLE",

        "word-table":
            "WORDTABLE",

        "address-table":
            "ADDRTABLE",

        "dispatch-table":
            "ADDRTABLE",

        "rts-table":
            "RTSTABLE",

        "text-table":
            "TEXTTABLE"
    }


    return mapping.get(
        table["kind"]
    )


# ============================================================
# SOURCE GENERATION
# ============================================================

def run_da65(
    binary,
    info_file,
    output
):

    command = [

        CONFIG["tools"]["da65"],

        "--cpu",
        "6502X",

        "--info",
        info_file,

        "--output",
        output,

        binary
    ]


    execute(
        command
    )


# ============================================================
# ASSEMBLY
# ============================================================

def run_ca65(
    source,
    object_file
):

    execute([

        CONFIG["tools"]["ca65"],

        source,

        "-o",
        object_file
    ])


def run_ld65(
    object_file,
    linker_config,
    output
):

    execute([

        CONFIG["tools"]["ld65"],

        object_file,

        "-C",
        linker_config,

        "-o",
        output
    ])


# ============================================================
# VERIFICATION
# ============================================================

def verify_binary(
    original,
    rebuilt
):

    a = read_binary(
        original
    )

    b = read_binary(
        rebuilt
    )


    if a == b:

        return {

            "identical":
                True,

            "size":
                len(a),

            "sha256":
                sha256(a)
        }


    differences = []


    maximum = max(
        len(a),
        len(b)
    )


    for offset in range(
        maximum
    ):

        av = (
            a[offset]
            if offset < len(a)
            else None
        )

        bv = (
            b[offset]
            if offset < len(b)
            else None
        )


        if av != bv:

            differences.append({

                "offset":
                    offset,

                "original":
                    av,

                "rebuilt":
                    bv
            })


    return {

        "identical":
            False,

        "original_size":
            len(a),

        "rebuilt_size":
            len(b),

        "difference_count":
            len(differences),

        "first_differences":
            differences[:100]
    }


# ============================================================
# MODEL COMPARISON
# ============================================================

def compare_models(
    before,
    after
):

    changes = 0


    for category in [

        "regions",
        "functions",
        "tables",
        "structures",
        "references"

    ]:

        before_set = \
            canonicalize(
                before[category]
            )

        after_set = \
            canonicalize(
                after[category]
            )


        changes += \
            count_differences(
                before_set,
                after_set
            )


    return changes


# ============================================================
# HUMAN OVERRIDES
# ============================================================

def apply_overrides(
    model,
    filename
):

    overrides = \
        load_yaml(
            filename
        )


    #
    # Examples:
    #
    # force_code:
    #
    #   - 0x1000-0x1080
    #
    # force_data:
    #
    #   - 0x2000-0x20ff
    #
    # rename:
    #
    #   0x1234: UpdateEnemies
    #
    # table:
    #
    #   address: 0x3000
    #   type: address-table
    #   count: 16
    #
    # USER OVERRIDES ALWAYS WIN.
    #


    for item in overrides:

        apply_override(
            model,
            item,

            confidence=1.0,

            authority="USER_OVERRIDE"
        )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()
```

The resulting analysis loop is essentially:

```text
                         ┌───────────────┐
                         │ original.bin  │
                         └───────┬───────┘
                                 │
                                 ▼
                          normalize image
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │        DXA          │
                    │                     │
                    │ discover code       │
                    │ discover routines   │
                    │ discover ptr tables │
                    └──────────┬──────────┘
                               │
                               ▼
                       merge evidence
                               │
                               ▼
                       analysis/model
                               │
                               ▼
                 ┌────────────────────────┐
                 │    Ghidra Headless     │
                 │                        │
                 │ functions              │
                 │ CFG                    │
                 │ xrefs                  │
                 │ reads/writes            │
                 │ call relationships      │
                 └───────────┬────────────┘
                             │
                             ▼
                       merge evidence
                             │
                             ▼
                ┌─────────────────────────┐
                │ structural analyzer     │
                │                         │
                │ arrays                  │
                │ pointer tables          │
                │ split pointer tables    │
                │ dispatch tables         │
                │ records                 │
                │ strings                 │
                │ inline arguments        │
                └───────────┬─────────────┘
                            │
                            ▼
                      analysis/model
                            │
                  ┌─────────┴─────────┐
                  │ new information?  │
                  └──────┬───────┬────┘
                       YES       NO
                        │         │
                        │         ▼
                        │      stable
                        │         │
                        └────┐    ▼
                             │   da65
                             │    │
                             │    ▼
                             │ source.s
                             │    │
                             │    ▼
                             │ ca65/ld65
                             │    │
                             │    ▼
                             │ rebuilt.bin
                             │    │
                             │    ▼
                             │ binary compare
                             │
                             └── next analysis pass
```

### One change I would make before implementing this for real

I would make `model.json` slightly richer than the pseudocode above by attaching **confidence and provenance to individual assertions**, rather than only whole objects.

For example, instead of:

```json
{
  "address": 16384,
  "kind": "address-table",
  "confidence": 0.94
}
```

use something closer to:

```json
{
  "address": 16384,

  "claims": {
    "is_data": {
      "confidence": 0.99,
      "evidence": [
        "dxa:no-executable-path",
        "ghidra:data-reference"
      ]
    },

    "is_address_table": {
      "confidence": 0.94,
      "evidence": [
        "dxa:address-table-detector",
        "structural:15-of-16-valid-targets"
      ]
    },

    "targets_code": {
      "confidence": 0.97,
      "evidence": [
        "ghidra:indirect-jump",
        "runtime:target-executed"
      ]
    }
  }
}
```

That would let the system say something much more useful than simply *“this is a table.”* It could say:

> `$4000-$401F is certainly data (99%), probably a 16-entry address table (94%), and very probably a dispatch table pointing to executable routines (97%).`

That evidence model is, in my view, the most important part of building this into a genuinely good automatic 6502 reverse-engineering system.
