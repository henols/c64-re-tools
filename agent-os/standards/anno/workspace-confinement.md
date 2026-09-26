# Workspace Path Confinement

Every caller-supplied file path (image, `--out`, `--provenance`,
sidecars, ...) goes through the one seam before any fs call, on the
client. The broker only ever sees staged bytes under a basename. The
annotation DB is not a caller path; see store-ownership.md.

```ts
const out = storePathWithinWorkspace(args.out, workspaceRoot); // throws if outside
writeFileSync(out, text);
```

- Never write a second path validator. The seam follows symlinks; a
  string-prefix check lets a symlinked subdir escape.
- Inputs and outputs both count. A raw `--out` once overwrote a file
  outside the workspace.
- Never auto-pick an input or derive one path from another. Require
  each by name, and refuse if it is missing.
- Never import the host/container path-translation seams into the store.
  A host path would land writes outside the workspace.
- Don't echo file content in parse errors. That turns a refusal into
  a read oracle.
