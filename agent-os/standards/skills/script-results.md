# Skill Script Results

New skill scripts are plain `.ts`, run on Node >= 24. Never hand-write
new `.mjs`. Existing `.mjs` scripts are legacy.

The last stdout line is one JSON object:

```json
{ "ok": true, ... }
{ "ok": false, "message": "petcat: not a BASIC program (x.prg)" }
```

- `ok: false` exits non-zero. `ok: true` exits 0.
- Never print `ok: true` with an empty, partial or guessed verdict.
- A wrapped tool's exit code does not decide success. The script's own
  classifier does (`petcat` exits 0 on garbage).
- Helpers that call out resolve to `{ ok: false, message }` and never
  reject, so callers need no try/catch.
