---
quick_id: 260819-tsz
created: 2026-08-19
status: locked
source: user decision during /gsd-new-milestone release-mechanics gate
---

# Context — VERSION template + resolver

## Why this exists

The user was asked how v0.2.0 should reach npm (four concrete release-mechanics
options were presented). They rejected all four and specified a different
deliverable instead, verbatim:

> "you have to create some script that can bump the version numbers in a clever
> way, so we dont have to handle the version numbers and store it inside the code
> and it would be nice if it also can be read out from the package. thinking if
> one the numbers is a - it will be defaulted to 0 so it never counts up if the
> major or minor versions are updated by hand and pushed"

So the release of v0.2.0 is BLOCKED on this task. Nothing is pushed, tagged,
published or merged by this task.

## Locked decisions (do not revisit)

**D-1 — One source of truth, stored in the repo.** A `VERSION` file at repo root.
Today there are FOUR hand-maintained version strings and not one is true:

| Location | Says | Reality |
|---|---|---|
| `.claude/mcp/vice/package.json:3` | `0.1.1` | placeholder, CI overwrites at publish |
| `installer/package.json:3` | `0.1.1` | placeholder |
| `.claude-plugin/plugin.json:5` | `0.1.1` | never bumped by ANY automation |
| `.claude/mcp/vice/vice-proxy.ts:263` `PROXY_VERSION` | `0.1.0` | advertised over MCP `initialize` (`vice-proxy.ts:3209`), stale by 12 patches |

npm latest for `@henols/vice-mcp` is `0.1.12`. Remote git tags reach `v0.1.12`.
A local annotated tag `v0.2.0` sits on HEAD, unpushed.

**D-2 — The `-` placeholder means "auto-managed, resets to 0 on a hand bump".**
`VERSION` holds a *template*: each dot-component is either a literal integer or
`-`. Resolution rule, in full:

1. Compare the LITERAL (non-`-`) components of the template against the same
   positions of the currently-published version.
2. Literal prefix MATCHES → increment the FIRST `-` component from the published
   value at that position; every `-` component after it resolves to 0.
3. Literal prefix DIFFERS (a hand bump) → every `-` component resolves to 0.
4. No published version obtainable → every `-` component resolves to 0.

The point of rule 3 is the user's own words: *"so it never counts up if the major
or minor versions are updated by hand and pushed."* Hand-editing `0.2.-` to
`0.3.-` must publish `0.3.0`, never `0.3.13`.

**D-3 — Initial template is `0.2.-`**, which against published `0.1.12` resolves
to `0.2.0` — the version the pending release wants.

**D-4 — Readable at runtime from the package.** A running server must report the
REAL published version, not a placeholder. `npm version` rewrites `package.json`
inside the tarball at publish time, so the runtime reader reads its OWN
`package.json` and falls back to the repo-root `VERSION` template only in a git
checkout. The published MCP package is standalone: at runtime inside a tarball
there is NO repo-root `VERSION`, so the fallback must degrade cleanly and never
throw.

**D-5 — Single seam, per this repo's strongest convention.** ONE module owns
version reading. `vice-proxy.ts`'s `PROXY_VERSION` and
`installer/bin/cli.mjs:30`'s existing `SELF_VERSION` both route through it —
reconcile, do not duplicate. This repo documents the "single seam per concern"
pattern and treats re-deriving a seam locally as a named anti-pattern.

## Worked examples (must all be covered by tests)

| Template | Published | Resolves to | Rule |
|---|---|---|---|
| `0.2.-` | `0.1.12` | `0.2.0` | 3 — prefix `0.2` != `0.1` |
| `0.2.-` | `0.2.0` | `0.2.1` | 2 — prefix matches, patch increments |
| `0.3.-` | `0.2.7` | `0.3.0` | 3 — hand minor bump, patch resets |
| `0.-.-` | `0.2.7` | `0.3.0` | 2 then 0-fill — first `-` (minor) increments, later `-` reset |
| `1.0.0` | anything | `1.0.0` | fully pinned, no `-`, no bump |
| `0.2.-` | none | `0.2.0` | 4 — nothing published |

## Constraints inherited from the project

- Node >= 22.18, ESM, 2-space indent, double quotes, semicolons.
- `resources-sync.test.ts` fails CI on `.mts` -> `resources/*.mjs` drift. If any
  `.mts` is touched, run `node build.ts`.
- `scripts/check-npm-packages.mjs` asserts both published tarballs contain
  exactly the right files. A new `scripts/version.mjs` must not leak into either
  tarball.
- Tests co-located, `*.test.mjs` / `*.test.ts` next to the module.
- Baseline is green and must stay green: `npm run typecheck` clean,
  `npm run test:automated` 1671 pass / 0 fail / 5 todo.

## Hard prohibition

**DO NOT push, tag, publish, merge, or run `npm publish`.** The release is a
separate, explicitly-authorized step the user reviews first. `main` is 388
commits ahead of `origin/main`; any push is a real, irreversible npm publish.

## Verification stance

This project's documented, four-times-learned lesson is that a test written by
the same pass as the code proves little — the external check is what finds the
defect. So beyond unit tests over the table above, the resolver must be checked
against the REAL published version (`npm view @henols/vice-mcp version`) and its
output asserted to be a valid semver strictly greater than what is published.
