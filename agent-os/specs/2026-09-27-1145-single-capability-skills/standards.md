# Standards for Single-Capability Skills

The following standards apply to this work.

---

## skills/skill-md-shape

Applies to every new and rewritten SKILL.md. The description lists only the
trigger phrases for the skill's own capability. No skill-map table appears.
Another skill is linked inline only where the reader must go next. Each
skill ends with "What this skill does NOT do" and a Troubleshooting table.
The one-script rule is read as one capability (see `shape.md`).

---

## skills/cross-package-reach

The sibling skill changes from `c64-ram-capture` to `c64-project`. Its
example and its "Sibling skills" section are updated to name it. The
disassembler script reaches `ghidra-run` and `dxa-run` through
`resolveMcpModule()` and `process.execPath`, never by a static import.

---

## skills/script-results

Unchanged. New and moved scripts are plain `.ts` with a `{ "type": "module" }`
`package.json`, and they end with one `{ok, ...}` JSON line.

---

## skills/refuse-never-guess

Unchanged. `disassemble.ts` requires `--image` and refuses a missing
processor, entry point or image kind instead of guessing it.

---

## global/module-header

Every new module opens with a WHY THIS FILE EXISTS / WHAT NOT TO DO header,
with no phase or plan ids. Moved modules keep their headers, with the skill
names updated.
