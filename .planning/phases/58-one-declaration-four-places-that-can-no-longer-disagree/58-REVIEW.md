---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/mcp/vice/prerequisites.json
  - src/mcp/vice/prerequisites.test.ts
  - src/mcp/vice/package.json
  - .github/workflows/ci.yml
  - docs/phase58-declaration-provenance.md
  - README.md
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-09-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the phase 58 declaration deliverable: `prerequisites.json`, its colocated
structural test, the one-line `package.json`/`ci.yml` additions, the provenance
document, and the README correction. `prerequisites.test.ts`'s 20 cases all pass
locally, `tsc --noEmit` is clean, and every citation inside `prerequisites.json`
itself was independently re-opened and confirmed accurate (README table rows,
`host-tool.mts` refusal messages and line ranges, `ci.yml`'s measured install
line, `SKILL.md` troubleshooting rows) — the data file and its test are sound.

The defects found are all in the surrounding narrative and completeness, not in
the mechanically-tested JSON shape: `docs/phase58-declaration-provenance.md`
carries two citations that point at the wrong lines in the files they claim to
quote (one lands on an unrelated `.planning/REQUIREMENTS.md` table row, the other
lands inside an unrelated bash function in `ci.yml`), and `prerequisites.json`
itself omits one real, user-installed external tool (`unp64`, the packer oracle)
that the codebase already documents and resolves through its own env vars —
notable because this phase's stated purpose is a declaration of *every* external
tool the plugin needs. None of these rise to a security or runtime-correctness
issue (nothing reads `prerequisites.json` at runtime yet, per the phase's own
scope note), but a provenance document whose entire content is a set of
falsifiable citations should not contain incorrect ones, and an incomplete
"every tool" declaration will propagate its gap into Phase 60's refusal wiring
and Phase 61's doctor.

## Warnings

### WR-01: Wrong `.planning/REQUIREMENTS.md` line citation for the VICE version-gate quote

**File:** `docs/phase58-declaration-provenance.md:35` and `:42`
**Issue:** The doc quotes `.planning/REQUIREMENTS.md:88` as the "later evidence" that overturns
the README's old VICE-3.10 framing:
> `.planning/REQUIREMENTS.md:88` records the opposite, and is the later evidence:
> Reporting a VICE, ACME, Ghidra or dxa version number | No shipped tool refuses on one. `vice_cpu_history` runs over the text channel (`chis`); the VICE >= 3.10 floor is on `CPUHISTORY_GET`, an opcode no shipped tool calls

That exact table row is actually at `.planning/REQUIREMENTS.md:85`. Line 88 is a
different, unrelated row: `| Byte-identical guarding of the generated README | Owner
decision 2026-09-13 removes that assertion class... |`. The citation is off by
three lines and, followed literally, points a reader at the wrong evidence for
the document's central "Case one" argument. Both occurrences (the introduction
at line 35 and the "wins" restatement at line 42) repeat the same wrong number.
**Fix:** Change both citations from `.planning/REQUIREMENTS.md:88` to
`.planning/REQUIREMENTS.md:85`.

### WR-02: Wrong `ci.yml` line citation for the ACME banner-verification claim

**File:** `docs/phase58-declaration-provenance.md:102`
**Issue:** Case three states:
> It is graded `measured` and not merely `carried` because CI does not just run the install command -- it then proves the installed binary really is ACME by grepping its own version banner (`.github/workflows/ci.yml:70-72`)

`.github/workflows/ci.yml:70-72` is inside the `retry_apt()` helper's *failure*
branch (`echo "retry_apt: attempt ${attempt}/3 failed..."`, `sleep 5`, `done`) —
it has nothing to do with the banner grep. The sentence describing the intent
("and then PROVES the installed binary really is ACME by running it and
grepping its own banner") is at `ci.yml:50-51`, and the actual banner grep this
paragraph is describing runs at `ci.yml:80-81`
(`{ acme --version || acme --help; } ... | tee /tmp/acme-banner.txt` /
`grep -qi acme /tmp/acme-banner.txt`).
**Fix:** Change the citation to `.github/workflows/ci.yml:80-81` (the actual grep), or
`:50-51` if the intent is to cite where the behavior is described in prose.

### WR-03: `prerequisites.json` omits the `unp64` packer-oracle prerequisite

**File:** `src/mcp/vice/prerequisites.json`
**Issue:** The declaration's stated purpose (per this phase's scope note and
`docs/phase58-declaration-provenance.md`'s own framing) is a committed record of
"every external tool the plugin needs." The document declares eight tool ids
(`x64sc`, `c1541`, `petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`), and
`prerequisites.test.ts`'s required-tools case asserts exactly that set. But a
ninth, genuinely external, user-installed binary exists in this codebase:
`unp64` (the packer-identification oracle), resolved via the `UNP64`/`UNP64_PATH`
environment variables in `src/mcp/vice/host-tool.mts`'s `resolveOracleCommand()`
(around line 2803) and documented as a host-side install step in
`src/skills/c64-program-recon/SKILL.md:117-125` ("install an external identifier
on the **host** and point `UNP64` or `UNP64_PATH` at it"). Its two MCP tool ids,
`oracle.probe` and `oracle.run`, are members of `HOST_TOOL_IDS` and *do* appear —
but only under the `node` record's `unblocks.mcp` list, which is misleading:
Node being present does not make `oracle.probe`/`oracle.run` useful; the absence
of `unp64` is the actual, common reason those two tools report
`available: false` / degrade. A future doctor (Phase 61) or refusal wiring
(Phase 60) built by walking this file's `tools` object will never be able to
name `unp64` by id, tell a user what to install, or point at a remedy for it,
because no such record exists.
**Fix:** Add a `unp64` record to `prerequisites.json` (no `versionFloor`, `unblocks.mcp:
["oracle.probe", "oracle.run"]`, `unblocks.skills: ["c64-program-recon"]`, and a
`universal` remedy citing `src/skills/c64-program-recon/SKILL.md:117-125` and/or
`host-tool.mts`'s `resolveOracleCommand()`), and add `"unp64"` to
`prerequisites.test.ts`'s required-tool-ids list so the omission cannot silently
recur.

## Info

### IN-01: `acme`'s "measured" remedy text is not the literal command CI ran

**File:** `src/mcp/vice/prerequisites.json` (acme.remedies.linux, ecosystem `ubuntu`)
**Issue:** The entry is graded `"measured"`, and `docs/phase58-declaration-provenance.md`
Case three grounds that grade specifically in this being "an observed install,
not an asserted one" — i.e. the text is presented as what was actually run and
verified. The `text` field reads `"sudo apt-get install -y acme"`, but the line
it cites, `.github/workflows/ci.yml:78`, actually runs `retry_apt install -y acme`,
a shell function that expands to
`sudo apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y acme`.
The simplification is a reasonable one for a human-facing remedy (a user has no
`retry_apt` function to call), but it means the "measured" grade's own stated
justification — that this text is what was literally observed running — is not
quite true of the string a reader actually sees.
**Fix:** Either note in the remedy text or in `docs/phase58-declaration-provenance.md`
that the measured grade covers the *effective* apt invocation (package name and
manager), not a byte-identical copy of the CI script line, so a future reader
does not assume `prerequisites.test.ts` or the `measured` tag guarantees literal
text equality the way the dedicated debian-trixie/README parity test does for
`x64sc`.

---

_Reviewed: 2026-09-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
