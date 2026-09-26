# evidence/

Repo-only measured artifacts. Nothing here ships with a skill: `npx skills add`
copies only `skills/<name>/`, and this directory is outside it.

- `transients/danish.json` — the transient allow-list this project derived
  for its own release (three jitter runs, one host). It is evidence for the
  derivation method in `skills/c64-ram-capture/transients/README.md`, never an
  address set to reuse: every release derives its own.
- `transients/.gitignore` — refuses every image byte form in that directory.
