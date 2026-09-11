---
title: Promote tool selection from prose-in-one-skill to a lintable registry
trigger_condition: Next phase that touches the skill surface, the advertised tool list, or tools-manifest.json
planted_date: 2026-09-11
source: /gsd-explore — MCP tool redundancy census
---

# The idea

`capability-registry.ts` answers **"which backend provides this tool."** Nothing answers
**"which of these two tools should I pick."** That second question is the one that produces
wrong selections, and today it is answered only by
`src/skills/c64-program-recon/references/tool-selection.md` — 65 lines of prose, inside one of
nine skills, self-declared `Confidence: MEDIUM` and curated 2026-08-01, covering ~20 of the 72
live tools.

Promote it to the shape the project already uses for the adjacent problem: **a data-only module
beside `capability-registry.ts`**, holding one row per genuine overlap — the competing tool
names, which to prefer, and the one-sentence reason — with a rendering function, exactly as
`DENY_LIST` / `denyListRefusalMessage()` and `CAPABILITY_REGISTRY` already do.

# Why this beats deleting tools

The measured redundancy is small (4 REASONED candidates) and deletion collides with the
compatibility constraint in `CLAUDE.md` — *"a tool advertised on both keeps the same name and a
backward-compatible argument shape … the fork's list is unchanged from v0.1.x."* Rewriting and
registering selection guidance breaks nothing and addresses the actual failure mode, which is an
agent picking the wrong tool rather than the surface being too large.

# What it buys that prose cannot

- **It can be linted.** A test asserts every advertised tool is either in the registry or
  explicitly marked as needing no disambiguation — so a new tool cannot ship without a selection
  answer, and a removed tool cannot leave a dangling recommendation. `tool-selection.md` still
  routes to `vice_sid_get_state`, which is not advertised; no mechanism would have caught that.
  The precedent exists: `skills-planning-vocabulary.test.ts` and `docs-linerefs.test.ts` already
  enforce prose properties mechanically.
- **All nine skills can read it**, instead of one.
- **One authority.** It ends the current situation where `tool-selection.md` is a hand-maintained
  partial copy of registry data — the "re-deriving a cross-cutting seam locally" anti-pattern,
  and the thing `capability-registry.ts`'s own header explicitly forbids.
- **It can feed the tool descriptions themselves**, closing the `anno_*` / `vice_*` discipline
  gap at the point of selection rather than in a document the agent may never open.

# The seed rows (REASONED — each needs confirming before it is written as fact)

    vice_watch_add          vs vice_checkpoint_add        self-described alias ("shorthand for
                                                          checkpoint with store/load")
    vice_run_until          vs checkpoint_add + execution_run, and vs vice_cycles_stopwatch
    vice_ping               vs vice_diagnose              NOT an overlap — different questions;
                                                          record it as a disambiguation row so the
                                                          resemblance stops costing a decision
    vice_execution_until_return  within the 5-tool stepping cluster
    vice_registers_available vs vice_registers_get
    vice_keyboard_type      vs vice_keyboard_petscii      both feed the KERNAL buffer
    anno_disassemble        vs anno_read_region view:'disasm'   already disambiguated in prose —
                                                          lift it into data unchanged
    anno_get_address_details vs its four components       a disclosed aggregate, not a duplicate

Note the registry must carry **both** directions: "prefer A over B" rows *and* "these look alike
but answer different questions" rows. `vice_ping` vs `vice_diagnose` is the second kind, and
suppressing it would lose the finding that stopped it being deleted.

# Watch out for

Do not seed the registry from `tools-manifest.json` — it describes a surface that is not
advertised (see [[tools-manifest-drift]] and [[mcp-tool-redundancy-census]]). Seed it from the
live advertised list.
