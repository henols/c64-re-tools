---
task: quick-260819-tsz
reviewed: 2026-08-19T20:14:58Z
depth: standard-plus (targeted deep dive per reviewer brief)
files_reviewed: 12
files_reviewed_list:
  - VERSION
  - .claude/mcp/vice/version.ts
  - .claude/mcp/vice/version.test.ts
  - scripts/version.mjs
  - .github/workflows/ci.yml
  - .claude/mcp/vice/vice-proxy.ts
  - installer/bin/cli.mjs
  - installer/package.json
  - .claude/mcp/vice/package.json
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - scripts/check-npm-packages.mjs
findings:
  critical: 0
  high: 0
  medium: 4
  low: 4
  total: 8
status: issues_fixed
fixed_at: 2026-08-19
fix_outcomes:
  MED-1: fixed (ee0a4f5)
  MED-2: fixed (30ce982)
  MED-3: fixed (5293b49)
  MED-4: fixed (d9efb1a)
  LOW-1: fixed (0af8acd)
  LOW-2: fixed (beb0b82)
  LOW-3: fixed (c54f663)
  LOW-4: fixed (811746b)
---

# Quick Task 260819-tsz — Code Review Report

**Verdict:** No CRITICAL/blocking defects against the release path this task actually wires up (`VERSION` = `0.2.-`, real `npm view` output) — the six worked examples, the strictly-greater CLI guard, the never-throw runtime boundary, and the CI wiring are all correct and match the locked spec. The real defects are in the resolver's handling of template/version shapes the six-row table never exercises, plus one concrete developer-facing regression in the installer's placeholder handling — none of these fire with the currently-committed template, but all are reachable by a plausible future hand edit or a direct dev-checkout invocation, and none are covered by a test.

**Counts:** 0 CRITICAL, 0 HIGH, 4 MEDIUM, 4 LOW.

**Most important finding:** MED-1 — `resolveVersion`/`parseTemplate` silently accept template shapes where a `-` precedes a literal (e.g. `-.2.3`), which are outside D-2's worked-example table and whose "literal prefix" semantics become ill-defined; demonstrated to produce a `prefix-differs` resolution that resets the *major* (auto) slot to 0 while echoing back unrelated literals, a case CONTEXT.md never describes and that the CLI's strictly-greater guard only *sometimes* catches.

## Summary

Reviewed all 12 files named in scope for the quick task that replaces four hand-maintained version strings with one `VERSION` template plus a single resolver seam (`version.ts`), wired into `scripts/version.mjs`, `vice-proxy.ts`'s `PROXY_VERSION`, and three CI job steps.

Verified independently (beyond what the task description says was already checked):
- `resolveVersion("-.2.3", "5.9.9")` → `{version:"0.2.3", rule:"prefix-differs"}` (dash-before-literal shape, not in the spec table).
- `resolveVersion("1.00.0", "9.9.9")` → `{version:"1.00.0", rule:"pinned"}` (leading zero passed through verbatim — not valid semver).
- `parseTemplate("-.2.3")` and `parseTemplate("1.00.0")` both succeed (no rejection).
- No `git push`/`git tag`/remote-mutating command exists anywhere in `ci.yml` — the `release` job's stamp commit is genuinely local-only, confirming focus item 4's "never pushed" claim.
- `join` is already imported in `vice-proxy.ts` before its new use at line 276; `PROXY_VERSION`'s `runtimeVersion()` call sits after the `uncaughtException`/`unhandledRejection` handlers are registered (line 239 vs 275), and `runtimeVersion`'s own try/catch means it could not crash the boundary even if handler ordering were reversed.
- `installer/bin/cli.mjs`'s `MCP_VERSION` is read straight from the working tree's `installer/package.json` dependency pin, which is now permanently `0.0.0-dev` outside the CI-stamped checkout — confirmed this feeds directly into the `.mcp.json` server spec written for end users (`${MCP_PKG}@${MCP_VERSION}`).

## Medium Issues

### MED-1: `resolveVersion`/`parseTemplate` accept dash-before-literal template shapes with unspecified, potentially-wrong semantics

**Outcome:** fixed (commit `ee0a4f5`). Applied the suggested fix as-is: `parseTemplate` now throws once a literal component follows a `-` component. Added `-.2.3`, `0.-.2`, `-.-.5` to the malformed-template test table and a dedicated regression test confirming the committed `0.2.-` template still parses. `npm run test:automated`: 17/17 for `version.test.ts` immediately after this commit.

**File:** `.claude/mcp/vice/version.ts:63-82` (`parseTemplate`), `:108-139` (`resolveVersion`)
**Issue:** `parseTemplate` validates each of the three components independently (`/^(\d+|-)$/`) with no constraint on *ordering* — it happily accepts `-.2.3`, `0.-.2`, `-.-.5`, etc. `resolveVersion`'s `prefixMatches` check (`components.every((c, i) => c === "-" || Number(c) === pub[i])`) then treats "literal prefix matches" as "every literal component, wherever it sits, matches the same index of `published`" — a defensible reading of D-2 rule 1's literal wording ("compare the literal components... against the same positions"), but it silently generalizes past the *only* shapes CONTEXT.md's worked-example table and D-2's own informal name ("literal **prefix**") ever describe (dash trailing, never leading or interior).

Demonstrated (empirically run against the committed code):
```
resolveVersion("-.2.3", "5.9.9")
  => { version: "0.2.3", rule: "prefix-differs" }   // major, the only dash, reset to 0
resolveVersion("-.2.3", "0.1.0")
  => { version: "0.2.3", rule: "prefix-differs" }   // compareVersions("0.2.3","0.1.0") = 1 → CLI guard PASSES
```
In the second case the CLI's strictly-greater guard (`scripts/version.mjs:138-152`) does **not** catch anything wrong, because `0.2.3 > 0.1.0` numerically — even though the "prefix differs" branch reset the auto-managed major slot to `0` while two unrelated literals (`2`, `3`) were merely echoed back unchanged. This is not any of the four outcomes D-2 documents; the six-row table has no row where a dash precedes a literal. `version.test.ts` has zero coverage of this shape.

The current committed `VERSION` (`0.2.-`) is safe — dash is trailing — so this does not fire on the pending v0.2.0 release. It is a latent defect in the resolver contract itself, exactly the kind of gap this task's spec's "verification stance" (external check over trusting a same-pass test) exists to catch, and it decides what gets permanently published to npm.

**Fix:** Enforce in `parseTemplate` that once a `-` component appears, every subsequent component must also be `-` (i.e. literals form a genuine contiguous prefix, dashes only trail):
```ts
let sawDash = false;
for (const part of parts) {
  if (part === "-") { sawDash = true; continue; }
  if (sawDash) {
    throw new Error(
      `version.ts: malformed template ${JSON.stringify(raw)} -- a literal component cannot follow a "-" component`
    );
  }
  if (!TEMPLATE_COMPONENT.test(part)) { /* existing check */ }
}
```
Add `-.2.3`, `0.-.2`, `-.-.5` to the `parseTemplate` "throws on malformed" test table.

### MED-2: `parseTemplate` accepts leading zeros, producing invalid-semver resolved output

**Outcome:** fixed (commit `30ce982`). Applied the suggested regex tightening exactly: `TEMPLATE_COMPONENT = /^(0|[1-9]\d*|-)$/`. Added `1.00.0` / `0.007.0` to the malformed-template test table.

**File:** `.claude/mcp/vice/version.ts:54` (`TEMPLATE_COMPONENT`)
**Issue:** `TEMPLATE_COMPONENT = /^(\d+|-)$/` accepts `"00"`, `"007"`, etc. A pinned or literal component with a leading zero is passed through **verbatim** into the resolved version string (`resolved.map((c,i) => c === "-" ? ... : c)` keeps the original text). Confirmed: `resolveVersion("1.00.0", "9.9.9")` → `{ version: "1.00.0", rule: "pinned" }`. Per SemVer 2.0.0 §2, numeric identifiers with leading zeros are invalid; `npm version "1.00.0"` will very likely reject this at publish time. That is a "fail loud" outcome (acceptable), but it is an avoidable CI failure caused entirely by input this seam should have rejected at parse time, since it is the one place per D-5 that owns validating the hand-edited `VERSION` file.
**Fix:** Tighten the regex to disallow leading zeros except for a bare `"0"`:
```ts
const TEMPLATE_COMPONENT = /^(0|[1-9]\d*|-)$/;
```

### MED-3: Installer footgun — `installer/bin/cli.mjs` can wire an unresolvable `@henols/vice-mcp@0.0.0-dev` into a real project's `.mcp.json`

**Outcome:** fixed (commit `5293b49`), NOT via the review's bare one-liner. Did both: fall back to `"latest"` when the dependency pin equals the dev placeholder, AND emit a loud single-line stderr warning naming the situation (unstamped dev checkout, placeholder pin, `.mcp.json` will say `latest`). The placeholder literal `"0.0.0-dev"` is repeated in `cli.mjs` (installer targets Node >= 18 and cannot import `version.ts`'s `.ts` seam; the file isn't in the installer's tarball) with a comment naming `DEV_PLACEHOLDER` in `.claude/mcp/vice/version.ts` as the source of truth, matching the disclosed divergence already documented for `SELF_VERSION`. Manually verified (dry-run and a real write against a scratch target) that the CLI now warns and writes `@henols/vice-mcp@latest`. No automated test added: `installer/package.json`'s `files: ["bin/"]` whitelists the whole directory (unlike vice-mcp's per-file whitelist), so a colocated `cli.test.mjs` would leak into the published tarball — confirmed via `npm pack --dry-run --json` before reverting that file.

**File:** `installer/bin/cli.mjs:47-49`, used at `:103`, `:176`, `:227`
**Issue:** `MCP_VERSION` is derived from the *working tree's* `installer/package.json` `.dependencies["@henols/vice-mcp"]`, which R-2 now pins to `DEV_PLACEHOLDER` (`0.0.0-dev`) permanently in the committed source and only gets overwritten by `npm pkg set` inside the ephemeral, ephemeral-only publish jobs (`ci.yml`'s `publish-npm` / `release-on-merge`). Before this task, the same field held `0.1.1` — a stale but *real, previously-published* version. After this task, any direct invocation of the installer against this repo's checked-out (un-stamped) tree — e.g. a developer running `node installer/bin/cli.mjs /some/project` to test the installer locally, exactly the scenario the plan's own "Risk 1" names for `npm install` — writes `.mcp.json` with `args: ["-y", "@henols/vice-mcp@0.0.0-dev"]`. That version will never exist on the npm registry, so `npx` will 404 every time Claude Code tries to launch the `vice` MCP server for that project, with no error surfaced until the user actually tries to use it. `cli.mjs` performs no validation that `MCP_VERSION` is a real, resolvable identifier before writing it into a consumer's config — this is strictly worse than the previous stale-placeholder behavior, and nothing in this task's test/verification suite exercises `cli.mjs` directly (confirmed: `check-npm-packages.mjs` and `package.sh` only assert the file *exists*, never execute it).
**Fix:** Detect the placeholder and refuse or degrade gracefully, e.g.:
```js
const MCP_VERSION_RAW = /* existing derivation */;
const MCP_VERSION = MCP_VERSION_RAW === "0.0.0-dev" ? "latest" : MCP_VERSION_RAW;
```
(or emit a loud stderr warning + exit non-zero when run against an unstamped checkout), so a dev-checkout run cannot silently produce a permanently-broken `.mcp.json` for an end user.

### MED-4: `parsePublished` uses lenient `Number()` coercion instead of the strict digit validation used for templates

**Outcome:** fixed (commit `d9efb1a`). Applied the suggested strict-digit fix (`/^\d+$/` per component). Added tests proving `0x2`, `5e2`, and whitespace-padded components fall back to `no-published`, and that `0.2.0-rc.1` / `0.2.0+build` still parse to their core triple (the `+build` case was a new test; `-rc.1` already had coverage).

**File:** `.claude/mcp/vice/version.ts:91-99`
**Issue:** `parseTemplate` validates each template component with a strict regex (`/^(\d+|-)$/`), but `parsePublished` validates published-version components with `Number(p)` + `Number.isInteger(n) && n >= 0`. `Number()` accepts far more than plain decimal digit strings — hex-like literals (`"0x2"` → `2`), exponential notation (`"5e2"` → `500`), and whitespace-padded numbers all pass silently and get coerced into a number that doesn't reflect the original text. This is an inconsistency between the two validation paths in the same file, and it means a malformed `--published` value or unexpected `npm view` output could be silently accepted as a real version component instead of correctly falling back to `no-published`. Currently harmless in the CI path because `npm view`'s stdout is always a clean plain-decimal version string, but it is the more permissive of two validators for what is effectively the same kind of input.
**Fix:**
```ts
function parsePublished(published) {
  if (published == null) return null;
  const core = published.split(/[-+]/, 1)[0];
  const parts = core.split(".");
  if (parts.length !== 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.map(Number);
}
```

## Low Issues

### LOW-1: `pub[i] + 1` has no overflow guard for pathologically large published components

**Outcome:** fixed (commit `0af8acd`). Added the guard: throws when `pub[i] >= Number.MAX_SAFE_INTEGER` rather than silently losing precision. Added a regression test.

**File:** `.claude/mcp/vice/version.ts:134`
**Issue:** If a published component reaches `Number.MAX_SAFE_INTEGER`, `pub[i] + 1` silently loses precision (float rounding), which could produce a version that is not actually incremented, violating the "always publishes something new" invariant the whole seam exists to guarantee. Purely theoretical for real-world semver (patch counts in the billions are not realistic), but worth a one-line comment acknowledging the assumption given how load-bearing this arithmetic is.
**Fix:** Add a guard/comment, e.g. `if (pub[i] >= Number.MAX_SAFE_INTEGER) throw new Error(...)`.

### LOW-2: Comment-stripping regex in the "single-implementation guard" test doesn't respect string literals

**Outcome:** fixed (commit `beb0b82`), as directed: added an explanatory comment documenting the limitation rather than building a full tokenizer, since the file has no `//` inside a string today.

**File:** `.claude/mcp/vice/version.test.ts:247-250`
**Issue:** `src.split("\n").map((line) => line.replace(/\/\/.*$/, ""))` strips everything after the first `//` on each line, including inside string literals. `scripts/version.mjs` doesn't currently contain a `//` inside a string (e.g. a URL), so the test passes today, but a future edit that adds one (e.g. a doc-comment link, or an error message containing a URL) would silently truncate real code from the match target, potentially masking a genuine reintroduction of the `prefix-matches` literal this test exists to catch.
**Fix:** Use a proper comment-strip (e.g. only strip `//` when not preceded by a quote on the same line, or maintain an explicit allowlist) — low priority given current file contents, but worth a comment noting the limitation.

### LOW-3: `readTemplate`'s documented contract omits the empty-file case

**Outcome:** fixed (commit `c54f663`). Corrected the docstring to state the empty-string-vs-null distinction explicitly, and added a regression test proving an existing-but-blank `VERSION` file returns `""`, not `null`.

**File:** `.claude/mcp/vice/version.ts:159-173`
**Issue:** The doc comment says "Returns null (never throws) when the file does not exist," implying null is the only "no template" signal. In fact an *existing but empty/whitespace-only* `VERSION` file returns `""` (falsy, but `!== null`). Every current caller (`runtimeVersion`'s `if (template)`, `scripts/version.mjs`'s `if (!template)`) happens to treat both correctly via truthiness, so there is no live bug — but a future caller written against the literal docstring (`=== null` check) would silently mishandle an empty file as "template present, resolves to nothing."
**Fix:** Update the docstring: "Returns the empty string for an existing-but-blank file, and null only when the file is absent."

### LOW-4: CLI's `--published` guard treats any non-null but unparseable value more strictly than `resolveVersion`'s own "no-published" semantics

**Outcome:** fixed (commit `811746b`), via the review's second option: made the guard consistent with `resolveVersion`'s own handling by skipping the strictly-greater check when `result.rule === "no-published"` instead of `published === null`. Added a CLI-spawning test (`node scripts/version.mjs resolve --published dev` now exits 0 and prints `0.2.0` instead of failing with "could not compare").

**File:** `scripts/version.mjs:138-152`
**Issue:** `resolveVersion("0.2.-", "not-a-version")` is explicitly specified (and tested) to behave as `no-published` and succeed. But the CLI's guard only skips the strictly-greater check when `published === null` — a garbage `--published` value (e.g. a typo'd `--published dev`, or a hypothetical malformed `npm view` response) is non-null, so the guard still runs `compareVersions(result.version, published)`, which throws inside `compareVersions` (since it can't parse the garbage), and the CLI reports "could not compare" and exits 1 — even though the resolve itself succeeded fine as a `no-published` case. This is arguably acceptable "fail loud on ambiguous input," and is not necessarily wrong per the design's literal wording ("unless published is null"), but it's an inconsistency between two closely-related code paths that isn't tested either way and could confuse someone using `--published` interactively.
**Fix:** Either document this divergence explicitly (a one-line comment stating manual `--published` typos fail loud rather than silently degrading to no-published), or make the guard consistent with `resolveVersion`'s own null-vs-unparseable handling by skipping the check when `result.rule === "no-published"` instead of `published === null`.

---

## Fix Pass Summary (2026-08-19)

All 8 findings fixed, 0 skipped. Each fix committed atomically on `main`
(`ee0a4f5`, `30ce982`, `5293b49`, `d9efb1a`, `0af8acd`, `beb0b82`, `c54f663`,
`811746b`). Gates re-run after all fixes:

- `.claude/mcp/vice`: `npm run typecheck` clean.
- `.claude/mcp/vice`: `npm run test:automated` -- 1693 pass / 0 fail / 5 todo
  (baseline was 1687/0/5; +6 new tests from this fix pass, all passing).
- `node scripts/version.mjs resolve --published 0.1.12` -> `0.2.0`.
- `node scripts/version.mjs resolve` (live registry) -> `0.2.0`.
- `node scripts/version.mjs check` -> OK, all 6 derived strings equal
  `0.0.0-dev`.
- `node scripts/check-npm-packages.mjs` -> OK (59 vice-mcp files, 35
  installer files, 6 skills, transitive closure clean).
- `bash scripts/package.sh` -> succeeded, artifact built under
  (gitignored) `dist/`.
- All six of CONTEXT.md's worked-example rows re-verified directly against
  `resolveVersion()` after the fixes: all six still resolve to the stated
  version and rule.

No fix weakened or deleted an existing test. No push/tag/publish/merge was
performed; `main` remains ahead of `origin/main` as before this pass.

---

_Reviewed: 2026-08-19T20:14:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard, with targeted deep-dive per reviewer brief's focus list_
_Fixed: 2026-08-19_
_Fixer: Claude (gsd-code-fixer)_
