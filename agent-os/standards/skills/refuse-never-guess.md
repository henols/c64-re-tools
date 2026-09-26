# Refuse, Never Guess

When a required fact or input is missing or ambiguous, refuse and name
why. Never substitute a fallback.

```json
{ "ok": false, "message": "no literal SYS address in line 10 (SYS PEEK(43)+...)" }
```

- Never auto-pick an input file. Require it by name.
- Never guess an entry point, handover address or offset. A wrong value
  is spent downstream (disassembly, diffs) and is expensive to find.
- Pass the tool's decline reason through verbatim.
- "I don't know" is a valid, reportable result. A plausible default
  is not.
