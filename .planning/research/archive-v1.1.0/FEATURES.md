# Feature Research

**Domain:** Prerequisite/environment doctors and tool-location config — for `c64-re-tools` v1.1.0 ("The Prerequisite Doctor")
**Researched:** 2026-09-16
**Confidence:** MEDIUM-HIGH — every tool's *documented* behavior is well-sourced (official docs, man pages, source-linked GitHub issues); a few live-output quotes are reconstructed from issue trackers rather than a fresh local run, and are flagged as such below.

## Survey: how mature doctors actually behave

### `flutter doctor` / `flutter doctor -v`

Real reported output (GitHub issue #14962, a user's console paste):

```
[√] Flutter (on Microsoft Windows [Version 10.0.16299.248], locale en-US, channel beta)
[√] Android toolchain - develop for Android devices (Android SDK 27.0.0)
[√] Android Studio (version 3.0)
[!] Connected devices
    ! No devices available

! Doctor found issues in 1 category.
```

- **Grouping is per-capability/per-target-platform**, not per-binary: "Android toolchain", "iOS toolchain", "Android Studio", "Connected devices", "Chrome", "VS Code" — each group bundles several underlying binaries/SDKs/env vars behind one named capability a user actually cares about (jdx/mise, GitHub #14962).
- **Three-state symbols**, not two: `[✓]` OK, `[!]` warning/optional-but-worth-fixing, `[✗]`/`x` hard failure — visually distinguishing "present but degraded" from "absent and blocking" (Medium/QuickCoder writeups, GitHub #53680).
- **`-v` (verbose) adds depth, not new categories**: SDK install paths, exact plugin/tool version strings, per-device deployment target info — i.e. verbose mode answers "where did you find this and exactly what is it", not "what else did you check" (GitHub #53680: `-vv` was requested precisely because `-v` still wasn't giving everything an issue reporter wanted, showing users treat verbosity as a *depth* dial).
- **Exit code is not fully reliable in practice.** Flutter's own issue tracker (`flutter/flutter#89165`, `#32106`, and a `doctor --json` wrapper repo `a11y-witness#1082`) documents cases where doctor reports found issues but the process exit code doesn't reflect it, and separately where `--machine`/JSON output exits nonzero even on partial success requiring callers to add fallback parsing. **This is a warning, not a model to copy**: a widely-used tool's exit code has been unreliable enough that third-party wrappers built defensive fallbacks around it.
- Machine-readable mode exists (`--machine`) for CI/tool integration, decoupled from the human-readable tree.

### `brew doctor`

- Exit code is unambiguous and coarse: **0 only when it prints "Your system is ready to brew"**; **any warning produces exit 1** (Homebrew/legacy-homebrew#43879, corroborated by docs.brew.sh). There is no "warning but exit 0" middle state.
- Homebrew's own docs are explicit that most `brew doctor` warnings are **not blocking**: "If everything you use Homebrew for is working fine, you don't need to worry and can just ignore them" (docs.brew.sh/Common-Issues). This is the source of Homebrew's own long-standing community friction — `brew doctor` is *maintainer diagnostic output* dressed up as a user-facing health check, and its exit-code-1-on-any-warning is widely reported as too coarse for scripting (see the linked issues, several years running, never fully resolved).
- **Lesson for this project:** conflating "informational" and "blocking" into one exit code is a documented, long-lived source of complaints. Don't repeat it.

### `mise doctor`

- Framed explicitly as a **bug-report artifact**: "the `mise doctor` output should be reviewed and included in bug reports along with the command, relevant configuration, operating system, shell, and mise version" (mise.jdx.dev/troubleshooting).
- mise's config precedence model (documented separately, `mise.jdx.dev/configuration.html`) is the strongest same-shape precedent for this project's `env var → file → $PATH` layering: system config → global config → directory walk from cwd to root (or `MISE_CEILING_PATHS`) → per-directory `.local` variant overrides the non-local variant → **child directory always overrides parent**. mise additionally resolves *relative paths* differently depending on source — paths inside a config file resolve from that file's own directory, paths from the environment resolve from the invocation's cwd — a nuance worth carrying into a `tools.json` design if it ever allows relative paths (recommendation below: don't allow them, precisely to avoid this dual-resolution trap).

### `git config --show-origin` (and `--show-scope`)

The strongest concrete precedent for **making the winning source visible**, not just the winning value:

```
$ git config list --show-origin --show-scope
system  file:/etc/gitconfig       credential.helper=osxkeychain
global  file:/Users/you/.gitconfig  user.name=Your Name
local   file:.git/config          user.email=project@example.com
```

Every line pairs the **value** with its **origin (file path)** and, with `--show-scope`, its **scope tier** (`system`/`global`/`local`/`worktree`/`command`). Precedence is local > global > system, first match at the narrowest scope wins — but critically, `--show-origin` doesn't just report the winner, it lets a user audit *every* definition across every scope simultaneously, so a surprising value is explainable without hunting through three files by hand. This is the single best model available for question 5 below.

### `rustup show` / rustup toolchain overrides

- rustup's precedence ladder is fully documented (`rust-lang.github.io/rustup/overrides.html`): `+toolchain` CLI shorthand → `RUSTUP_TOOLCHAIN` env var → `rustup override` (a directory-keyed override database) → `rust-toolchain.toml` file → default toolchain. Directory overrides and the toolchain-file are **each also resolved by directory proximity** — whichever is closer to the cwd wins between those two, independent of the outer ladder.
- `rustup show` is the single command that answers "which toolchain is actually active right now and what does that resolve to" — it does not, by default, name *which rule in the ladder* produced that answer (no scope column like git's), which is a strictly weaker transparency story than `git config --show-origin`. This is a concrete example of a tool that gets *resolution* right but *explainability* only half right — a gap this project should not repeat now that `git config --show-origin` shows the better version is cheap to build.

### `dotnet --info`

Representative real output (Microsoft Learn / community captures, SDK 7.0/8.0 on Windows and Ubuntu):

```
.NET SDK:
 Version:   7.0.302
 Commit:    ...

Runtime Environment:
 OS Name:   Windows
 OS Version: 10.0.22000
 RID:       win10-x64
 Base Path: ...

.NET SDKs installed:
  7.0.302 [C:\Program Files\dotnet\sdk]

.NET runtimes installed:
  Microsoft.AspNetCore.App 7.0.7 [...]
  Microsoft.NETCore.App 7.0.7 [...]
```

- **Flat, per-component listing with resolved install paths inline** (`[C:\Program Files\dotnet\sdk]`) — every entry states *where* it was found, not just *that* it was found. No pass/fail semantics at all: `dotnet --info` is pure inventory, not a doctor — it never says anything is wrong, it just states what's there. Diagnosing "is this good enough" is left entirely to the caller (e.g., a `global.json` SDK-version mismatch is reported by a *different* mechanism, not by `--info`).
- Relevant lesson: an **inventory command** (state what's present and where) and a **doctor** (judge whether that's sufficient and say what's missing) are different tools even when unified in other ecosystems. Conflating them is fine at small scale but this project's doctor should keep the "per capability, pass/fail, remedy" judgment layer explicit rather than degrading to a `dotnet --info`-style flat dump.

### `git lfs env`

Real shape (git-lfs docs/wiki, `t/t-env.sh` fixtures):

```
git-lfs/3.4.0 (GNU/Linux)
git version 2.34.1

Endpoint=https://github.com/user/repo.git/info/lfs (auth=none)
LocalWorkingDir=...
LocalGitDir=...
LocalGitStorageDir=...
LocalMediaDir=...
LocalReferenceDirs=
TempDir=...
ConcurrentTransfers=8
...
git config filter.lfs.process = "git-lfs filter-process"
git config filter.lfs.smudge = "git-lfs smudge -- %f"
...
```

- Another pure-inventory command (like `dotnet --info`): versions of both the tool and its host (`git version`), resolved endpoints, resolved local directories, and — notably — **the exact git-config lines that make LFS work**, so a user can visually confirm the filter/smudge/clean hooks are actually wired, not just that the binary exists. This "show me the exact config lines that matter" idea is directly reusable: this project's doctor could echo the exact env var *name* and *value* it resolved, not just "found".

### `npm doctor`

Official docs (docs.npmjs.com/cli/v11/commands/npm-doctor) describe seven checks: registry connectivity, npm version, Node version, configured registry, `git` on PATH, directory permissions (cache, global, local `node_modules`), and cache tarball checksum validity. Reported table shape (from issue-tracker captures) is `Check | Value | Recommendation`, e.g.:

```
Check                  Value                                      Recommendation
npm ping               ok
npm -v                 v9.x.x
node -v                v18.x.x
npm config get registry  https://registry.npmjs.org/
git executable in PATH  ok
...
```

- **Known, documented defect worth citing directly as an anti-pattern**: `npm/cli#1226`, "npm doctor exit code 0 on ERR" — npm doctor printed failing rows but exited 0 regardless, for a long time. A doctor whose exit code doesn't track its own displayed status is a genuine, shipped, long-lived bug in a top-tier tool — strong evidence that this is an easy mistake to make and must be tested explicitly, not just implemented and assumed correct.

### `nvm debug` / `nvm current` / `nvm which`

- `nvm debug` bundles shell/environment diagnostics for **bug reports** (nvm version, `$SHELL`, `$TERM_PROGRAM`, `$SHLVL`, `whoami`, `$HOME`, `$NVM_DIR`, `$PATH`, plus `which node`/`which npm`/`npm config get prefix`) — same "maintainer support bundle" pattern as `mise doctor`. It is explicitly diagnostic-for-humans-filing-issues, not a pass/fail report a script should parse.
- nvm resolves the active Node version via `.nvmrc` (project file) vs. explicit `nvm use` (session override) vs. a configured default alias — files win when explicitly asked for (`nvm use` with no arg reads `.nvmrc`), but there's no single command that prints "here's the winning source and why" the way `git config --show-origin` does. Users report confusion about which took effect when both exist, which is exactly the failure mode question 5 is trying to avoid.

### `rustup`/`mise`/`asdf`/`.tool-versions` family — tool-location config file conventions

`asdf` has **no `doctor` command** (mise added one; asdf did not, per official command list at asdf-vm.com/manage/commands.html) — worth noting as a negative data point: `.tool-versions`-style pinning and a *doctor* report are treated as separable concerns even by the tool that popularized the pinning-file convention. asdf's own precedence: an `ASDF_${TOOL}_VERSION` env var **overrides** anything in `.tool-versions` — env var beats file, exactly the ordering decision 5 in this project's PROJECT.md already settled on (`env var → file → $PATH`).

### Claude Code's own `/doctor` (`claude doctor`) — the directly relevant in-ecosystem precedent

This is the most on-point precedent available, since it ships inside the exact platform this plugin runs on:

- **Runs standalone, before any session, on a plain terminal** — "running `claude doctor` from a plain terminal without starting a session prints read-only installation diagnostics" (ClaudeLog, Vincent's Blog, Tim Schipper's writeup). This is structurally identical to this milestone's hard constraint #2: the doctor must run on a Node too old to run the MCP server itself, i.e., before the thing it's checking is even usable.
- **Read-only by design, historically** — "allowing you to check for installation health and configuration file errors without worrying about anything being changed automatically." As of a later Claude Code version (per the same sources) `/doctor` gained the ability to *fix* some issues directly and gained a `/checkup` alias — i.e. even Anthropic's own tool eventually blurred the report/fix line. **This project's hard "never auto-install" constraint means that blur is explicitly the wrong direction to follow here**; the doctor must stay report-only, permanently, not as a v1 limitation to relax later.
- **Three-color status model**: green/passing, yellow/warning, red/error — the same three-state shape as `flutter doctor`'s `✓/!/✗`.
- Later versions report **cost, not just presence** — "unused skills, MCP servers, and plugins versus their context cost." Not directly transferable (this project's doctor reports binaries, not context budget) but the underlying idea — report not just yes/no but *what it's costing you* — maps onto this project's decision #4 (report which skills/capabilities a missing tool blocks, not just "ACME: absent").

## Synthesis, mapped to the six questions

**1. Output shape.** Universally: status symbol + name + (if present) resolved version + (if present) resolved path/source + (if absent or degraded) why it matters + remedy. "Present but too old" is distinguished from "absent" with a **distinct third state** (warning, not error) in every grouped-capability tool (`flutter doctor`'s `!`, Claude Code's yellow) — never collapsed into the same red. "Absent but optional" vs "absent and blocking" is distinguished the same way in the tools that get it right (Claude Code, Flutter) — reserving hard-fail red exclusively for things that block a stated capability, with everything else yellow/informational. Verbose modes (`-v`/`-vv`) add *depth* (exact paths, exact version strings, exact resolved config lines — see `git lfs env`'s config-line echo) rather than new categories.

**2. Grouping.** Per-capability is the pattern that wins in the tools users actually praise for clarity (Flutter's toolchains, Claude Code's skills/MCP-servers-vs-cost). Pure per-binary flat lists (`dotnet --info`, `git lfs env`, `nvm debug`) work fine for *inventory* tools where the audience already knows what each binary is for, but they push the "is this a problem" judgment onto the reader. This project's decision #4 (capability-mapped, not flat) matches the evidence: the owner's own framing — "the tools that are needed for being able to use the skills and the mcp" — is precisely Flutter's "Android toolchain" pattern applied to this domain (map to *skills*, not to *binaries*).

**3. Exit codes — explicit recommendation.** Evidence shows real tools get this wrong two different ways: `brew doctor` (any warning → exit 1, too coarse, decades of complaints) and `npm doctor` (a shipped bug where the displayed table said FAIL but the exit code said 0, `npm/cli#1226`). **Recommendation: three-tier exit code, not two.** `0` = everything present and at floor version (no yellow, no red); a **distinct nonzero code for "at least one yellow, no red"** (e.g. `1`) so a CI script can choose to treat degraded-but-working as pass or fail explicitly rather than the doctor deciding for it; and a **different nonzero code for "at least one red / blocking capability"** (e.g. `2`). This is strictly more useful than brew's binary model without repeating npm's bug (which was an implementation defect, not a design choice — the fix here is to make exit-code correctness a directly-tested property, since npm's own bug proves this is exactly the kind of thing that silently drifts out of sync with the displayed report). Two-state (0/1) is the table-stakes minimum if three-state is judged too much scope; **exit-code-doesn't-match-displayed-status is the one failure mode to test explicitly regardless of which model is chosen**, because it has a real, cited precedent of shipping unnoticed in a major tool.

**4. Remedies.** Every surveyed tool that prints remedies prints **text**, not an offer to execute — `npm doctor`'s Recommendation column, `flutter doctor`'s inline hints, brew's warnings pointing at `docs.brew.sh` sections. None of the read-only-by-default tools surveyed *execute* a fix from inside the doctor itself; the one in-ecosystem tool that *did* cross that line — Claude Code's `/doctor` gaining auto-fix in a later version — is the version of "doctor" that best matches this project's platform, and it is precisely the direction this project's standing constraint forbids. **A report-only doctor here should: print the exact remedy per platform** (the README's existing per-distro install lines are the ready-made content for this — `apt`/`brew`/`pacman`/`dnf` strings already exist per tool) **and never offer, prompt for, or execute installation** — not even behind a flag, since a flag is a slippery slope the constraint explicitly closes off (see decision 2: the stricter alternative of withdrawing the three existing install carve-outs was *declined*, meaning existing carve-outs stay narrow and no new one should open).

**5. Tool-location config files — recommended concrete design.** The strongest precedent is `git config --show-origin`: pair every resolved value with **where it came from**, and make every candidate source auditable, not just the winner. Concretely, for this project's `env var → file → $PATH/sibling-probe → refuse-by-name` ladder (already decided), each row of doctor output should read like:

```
[✓] ACME          0.97  via ACME_BIN=/opt/acme/bin/acme        (env var)
[✓] c1541         3.10  via sibling of x64sc (/usr/bin/c1541)  ($PATH sibling probe)
[✗] Ghidra        —     not found — no GHIDRA_HOME, no tools.json entry, not on $PATH
                          remedy: set GHIDRA_HOME or add "ghidra" to .c64-re-tools/tools.json
```

i.e. **name the winning source inline on every row**, exactly as `git config --show-origin` names the file, so a surprising resolution (a stale env var shadowing a freshly-edited `tools.json`) is self-explaining without a second command. Don't stop at "resolved: /path" — state *which rung of the ladder* supplied it. mise's config-precedence model (child-overrides-parent, `.local` overrides non-local) is a good model for *file* precedence if this project ever needs more than one `tools.json`, but the milestone's own scoping already settled on a single file at `.c64-re-tools/tools.json`, so that complexity is out of scope — noted here only so a later reader doesn't reach for it unprompted. Format: **JSON**, matching every other file already in `.c64-re-tools/` (`snapshots/*.json` sidecars, `supervisor/` state) — no new format (TOML/YAML) to parse, no new dependency. Avoid relative paths in the file entirely (mise's dual-resolution-by-source nuance is a real, documented footgun — sidestep it by requiring absolute paths only, and having the doctor say so in its own validation error).

**6. What a doctor should NOT do.** See Anti-Features table below — the clearest patterns across the survey are: don't execute fixes (Claude Code's own drift is the cautionary tale, doubly so given this project's constraint); don't let exit code and displayed status diverge (`npm doctor`'s shipped bug); don't collapse "optional/degraded" and "blocking" into one status color (brew's long-running complaint history); don't build a second, independent detection path that can disagree with the one the tool actually uses at runtime (this project's own PROJECT.md already names this as "the specific mistake to avoid here").

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single command, runs before any session/install, on a Node too old to run the MCP server | Claude Code's own `/doctor` sets this bar in-ecosystem; this milestone's own hard constraint #2 makes it non-optional | MEDIUM | Cannot be a subcommand of the existing `.ts` entry (Node ≥24 type-stripping); needs its own low-floor entry point — a plain `.mjs`/`.cjs` or a pure-JS `bin` script, per the scoping note already in PROJECT.md |
| Per-item status: present / present-but-below-floor / absent-optional / absent-blocking (3–4 states, not 2) | Every mature tool surveyed (Flutter's `✓/!/✗`, Claude Code's green/yellow/red) uses at least 3 states; collapsing to pass/fail loses exactly the distinction users need to triage | LOW | Reuses existing per-tool probes (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`, `findAcmeLib()`, Ghidra search) already returning enough info to derive these states |
| Reports which skill(s)/MCP capability is blocked by each missing/degraded tool, not just the bare binary name | Owner's own framing ("tools needed for being able to use the skills and the mcp"); Flutter's per-toolchain grouping is direct precedent for this mapping model | MEDIUM | Requires a static declaration (tool → skills/capabilities it unblocks) — this is exactly "One committed prerequisite declaration" already named as a target feature |
| States the resolved path/version AND which source supplied it (env var / file / $PATH-sibling-probe) on every present row | `git config --show-origin` is the strongest precedent; without this, a layered `env var → file → $PATH` resolution is unauditable when it surprises someone | LOW-MEDIUM | This is purely a reporting change over probes that already resolve a path — no new detection logic, just surfacing which branch fired |
| Per-platform remedy text on every absent/below-floor row | Every surveyed tool with a Recommendation column does this (`npm doctor`); this project already has the content in README's per-distro tables and `acme-build/SKILL.md`'s prefix list — the doctor should be *generated from* the same declaration, per the milestone's own target feature | LOW | Content exists today, scattered; the doctor's job is to centralize and print it, not invent new remedy text |
| Exit code that tracks displayed status, tested explicitly | `npm doctor`'s shipped bug (`npm/cli#1226`, exit 0 despite failing rows) is a real, citable precedent for how easily this drifts | LOW | A single unit test asserting exit-code-matches-worst-row-status closes exactly the gap npm shipped with |
| Never invokes a package manager or offers to install/fix anything, even behind a flag | Project's own standing, non-negotiable constraint (CLAUDE.md); Claude Code's own `/doctor` blurring this line in a later version is the in-ecosystem cautionary tale to explicitly not follow | LOW (as a constraint — it's an absence, not a build) | The risk is scope creep via a well-intentioned `--fix` flag; must be named as permanently out of scope, not "not yet" |
| Reuses the exact probes the runtime tools already use for detection (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`, `findAcmeLib()`, Ghidra `analyzeHeadless` search) — no second detection path | PROJECT.md already names "minting a second detection path" as the specific mistake to avoid; `rustup show` vs. actual toolchain-resolution-at-invocation-time divergence bugs (GitHub rustup#5034, "rustup toolchain list produces outdated info if a toolchain was just auto-installed") show real-world cost when a reporting path and an execution path can disagree | MEDIUM | The doctor becomes a thin reporting harness over existing functions, not a reimplementation — architecturally this is the highest-value complexity control in the whole feature set |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `.c64-re-tools/tools.json` location file, layered under env vars, with a doctor-written commented template | Closes the gap that today `c1541`, `petcat`, and dxa have **no** location override at all (three of six tools); gives every tool a uniform way to say "it's over here" without hunting for the right ad-hoc env-var name (today: three different naming conventions — `VICE_BIN`, `ACME_BIN`/bare `ACME`, `GHIDRA_HOME`) | MEDIUM | Already scoped as a target feature; JSON keeps format consistent with the rest of `.c64-re-tools/`; gitignored already via `toolsDir()`, so no risk of a machine-specific absolute path landing in a commit |
| Machine-readable output mode (`--json`) alongside the human-readable report | Flutter's `--machine` and npm doctor's structured table both exist because scripts/CI want to consume doctor output without scraping text; enables a future CI smoke-check without re-implementing detection | LOW-MEDIUM | Not named as a target feature in PROJECT.md's scope — flag as a candidate for a later milestone rather than assumed in v1.1.0 |
| `README.md` install tables generated (semantically checked, not byte-identical-guarded) from the same declaration the doctor reads | Removes the standing risk named in PROJECT.md: 4 places (README, SKILL.md prefix list, inline refusal strings, and now tools.json/doctor) that can disagree with no mechanism catching drift | MEDIUM-HIGH | Explicitly scoped as a target feature; must honor the Phase 54 decision (no byte-identical guard) — semantic check only (e.g. every declared tool's remedy appears somewhere in README, not that the table text matches word-for-word) |
| Doctor prints the exact resolved env-var *name and value* it used (not just "found via env var") | `git lfs env`'s pattern of echoing the literal git-config lines that matter, applied to this project's five ad-hoc env vars | LOW | Cheap addition once the per-row source is already being tracked for the table-stakes item above |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| `doctor --fix` / auto-install missing tools | Users expect "doctor" to imply "and cure it too" — Claude Code's own `/doctor` went this direction in a later version, and `brew`/`npm`/package-manager ecosystems generally, normalize "just run the fixer" | Directly violates the project's non-negotiable, owner-stated constraint (CLAUDE.md, "never auto-install"); every one of this project's six external tools is intentionally detect-and-refuse-by-name; adding a fixer reintroduces exactly the risk class the constraint exists to prevent (arbitrary package-manager invocation, platform-specific breakage, no user consent boundary) | Print the per-platform remedy command as text only; the user runs it themselves, exactly as the existing refuse-by-name pattern already does |
| A second, independent "quick" detection path inside the doctor (e.g., its own lightweight `which`-based check, separate from `resolvedBackend()`/`findSiblingBinary()`/etc.) | Looks like a reasonable optimization — "the doctor doesn't need the full probe logic, a simpler check is enough for a report" | Two probes that can disagree are worse than one probe with no reporting surface — PROJECT.md names this explicitly: the doctor could then contradict the refusal a user actually hits at tool-call time; this is the single most-repeated failure shape across the ecosystem survey (rustup#5034's stale-toolchain-list bug is the general-purpose version of this exact mistake) | Call the exact same functions the runtime dispatch path calls; the doctor is a thin report layer, never a parallel implementation |
| Collapsing all non-OK states into a single exit code / status color | Simpler to implement, and `brew doctor` ships exactly this | Years of community friction (`brew doctor` warning-vs-blocking conflation) is the direct citable cost; a CI script or a user skimming output cannot tell "annoying but fine" from "will actually fail" without reading every line | Three-state status (OK / degraded-optional / blocking) with a matching three-tier exit code, per the recommendation above |
| Silent "best effort" fallback resolution that doesn't say which source won | Feels like less noise in the common case where only one source is ever configured | The moment two sources *do* disagree (a stale env var plus a freshly-edited `tools.json`), the user has no way to find out why the "wrong" one won without reading source — the exact failure mode `git config --show-origin` was built to solve, and the exact failure mode nvm users report around `.nvmrc` vs explicit `nvm use` | Always print the source, on every resolved row, unconditionally — it's one field, not a verbose-only extra |
| A `--verbose`/`-v` mode that adds *new checks* rather than more detail on existing ones | Tempting scope creep — "since we're in verbose mode, let's also check X" | Diverges from every surveyed tool's actual verbose-mode contract (Flutter's `-v`/`-vv` adds paths/versions/detail, not new categories — evidenced by the GitHub #53680 complaint that `-vv` *still* didn't add new categories, which is treated as expected, not a bug); a verbose mode that changes *what* is checked rather than *how much detail* is shown breaks the mental model that "the non-verbose summary is the complete truth, just terser" | Keep verbose strictly additive-detail: same checks, same statuses, more fields per row (exact path, exact version string, exact source) |
| Generating `README.md`'s tables byte-identically from the declaration, guarded by a diff test | Feels rigorous — "make sure docs can't drift" | Owner decision 2026-09-13 (Phase 54) already removed every byte-identical assertion in this codebase as unproductive; rebuilding one here for this feature would be re-implementing the exact thing that decision retired | Semantic check only: assert every declared tool's remedy text is *present somewhere* in README, not that the generated block matches character-for-character |

## Feature Dependencies

```
Doctor CLI entry point (low-Node-floor, standalone)
    └──requires──> One committed prerequisite declaration
                       (tool → version floor → unblocks-which-skill → per-platform remedy)
                       └──requires──> Existing per-tool probes
                                          (resolvedBackend, findSiblingBinary, findDxaBinary,
                                           findAcmeLib, Ghidra analyzeHeadless search)

Capability-mapped report (per skill/MCP capability, not per binary)
    └──requires──> One committed prerequisite declaration

Per-row "resolved via <source>" reporting
    └──requires──> tools.json location file
    └──requires──> existing env-var overrides (VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME, VICE_BROKER_NODE)
    └──requires──> $PATH / sibling-probe fallback already implemented in host-tool.mts

tools.json resolution ladder (env var → file → $PATH/sibling probe → refuse by name)
    └──requires──> toolsDir()/.c64-re-tools root (already exists, D-33)

README install tables generated from declaration ──enhances──> One committed prerequisite declaration
   (must stay semantic-check-only, not byte-identical — Phase 54 conflict if built the other way)

doctor --fix / auto-install ──conflicts──> the project's never-auto-install constraint (CLAUDE.md)
second independent detection path ──conflicts──> "doctor calls the probes that already ship" (PROJECT.md target feature)
```

### Dependency Notes

- **Doctor CLI requires the prerequisite declaration, which requires the existing probes:** the declaration is the data (what to check, what it unblocks, what the remedy is); the probes are the mechanism (how presence is actually determined). Building the doctor before the declaration exists means hard-coding per-tool logic twice.
- **Per-row source reporting requires `tools.json` to exist as a resolvable layer**, not just as a written-but-unread file — if the doctor is shipped before the resolution ladder actually consults the file at runtime, the doctor's own "via tools.json" row would be reporting a fiction.
- **README generation enhances but does not gate the doctor** — it can ship in the same phase or a later one; the doctor itself does not need README regeneration to be useful, since the declaration alone gives the doctor everything it needs.
- **The two named anti-features (`--fix`, second detection path) conflict directly with target features already committed in PROJECT.md** — not just generically undesirable, but specifically ruled out by this milestone's own decisions 2–5. Listed as explicit conflicts so a later roadmap reader doesn't propose either as a "nice addition."

## MVP Definition

### Launch With (v1)

- [ ] Prerequisite declaration (one committed file/module: tool → version floor → skills/capabilities unblocked → per-platform remedy) — everything else depends on this existing first
- [ ] `vice-mcp doctor` entry point runnable on a pre-v24 Node
- [ ] Per-tool status row: OK / below-floor / absent-optional / absent-blocking, using only the existing probes
- [ ] Per-row resolved source (env var name / `tools.json` / `$PATH` sibling probe), unconditionally, not verbose-only
- [ ] `.c64-re-tools/tools.json`, consulted by the resolution ladder at `env var → file → $PATH/sibling probe → refuse by name`, with a doctor-written commented template on request
- [ ] Exit code that provably tracks the worst row's status (tested, given `npm doctor`'s cited history of getting this wrong)
- [ ] Capability-mapped grouping (per skill / per MCP capability), not a flat binary list

### Add After Validation (v1.x)

- [ ] `--json`/machine-readable output mode — add once a real CI or scripting consumer exists, not speculatively
- [ ] README table generation from the declaration (semantic-checked) — natural follow-on once the declaration has proven stable, but not required for the doctor itself to deliver value
- [ ] `-v`/verbose mode with per-row extra detail (exact version strings, full paths) — genuinely nice, but the non-verbose report is already useful without it

### Future Consideration (v2+)

- [ ] Multiple layered `tools.json` files (project vs. user-global, mise-style child-overrides-parent) — explicitly out of scope for this milestone per PROJECT.md's own scoping; only reconsider if a real multi-project-per-user pain point appears
- [ ] Doctor-driven `README.md` regeneration as a pre-commit/CI check — only after the semantic-check version has been live long enough to know if drift actually recurs (the DOCS-* precedent in this same project shows removed guards can silently regrow the problem within days — worth re-measuring before investing in enforcement)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Prerequisite declaration (data) | HIGH | MEDIUM | P1 |
| Doctor CLI entry point, low-Node-floor | HIGH | MEDIUM | P1 |
| 3–4 state per-item status | HIGH | LOW | P1 |
| Capability-mapped grouping | HIGH | MEDIUM | P1 |
| Per-row resolved source (`git config --show-origin` pattern) | HIGH | LOW-MEDIUM | P1 |
| `tools.json` location file + resolution ladder | HIGH | MEDIUM | P1 |
| Exit code tracks status (tested) | MEDIUM | LOW | P1 |
| Per-platform remedy text, generated from declaration | MEDIUM | LOW | P1 |
| `--json` output mode | LOW-MEDIUM | LOW-MEDIUM | P2 |
| README generation from declaration (semantic-checked) | MEDIUM | MEDIUM-HIGH | P2 |
| Verbose mode (extra per-row detail) | LOW-MEDIUM | LOW | P2 |
| Multi-file `tools.json` layering | LOW | HIGH | P3 |
| `--fix`/auto-install | — | — | **excluded, not scored** (violates standing constraint) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | `flutter doctor` | `brew doctor` | Claude Code `/doctor` | Our Approach |
|---------|-------------------|----------------|--------------------------|--------------|
| Grouping | Per-target-platform capability (Android/iOS/Chrome/VS Code) | Flat, maintainer-diagnostic-oriented | Mixed — install health + per-item (skills/MCP servers/plugins) with cost | Per-skill/per-MCP-capability, matching owner's own framing |
| Status states | 3 (`✓`/`!`/`✗`) | Effectively 2 (ready / any-warning) | 3 (green/yellow/red) | 3–4 (OK / below-floor / absent-optional / absent-blocking) |
| Exit code | Documented-inconsistent in practice (cited GitHub issues) | Binary, coarse (any warning → 1) | Not publicly specified in surveyed sources | 3-tier, explicitly tested against displayed status |
| Remedy | Inline hints, links to docs | Points at `docs.brew.sh` sections | Increasingly self-fixing (later versions) | Text-only per-platform remedy, generated from one declaration; never executes |
| Source transparency | Not source-per-row | N/A (single Homebrew install) | Not surfaced in reviewed sources | Every row states its resolved source (env var / file / $PATH), `git config --show-origin`-style |
| Location override file | N/A (installer-managed) | N/A | N/A | `.c64-re-tools/tools.json`, layered under existing env vars |
| Runs pre-install / low dependency floor | Yes (part of the SDK itself) | Yes (ships with brew) | Yes (explicit design goal, cited) | Required by this milestone's own constraint (Node-floor problem) |

## Sources

- [flutter doctor Doctor summary — DEV Community capture](https://dev.to/stargator/comment/7d37)
- [flutter doctor -vv is verbose output, doesn't include -v additional details — flutter/flutter#53680](https://github.com/flutter/flutter/issues/53680)
- [Flutter doctor summary — flutter/flutter#14962 (real console output quoted above)](https://github.com/flutter/flutter/issues/14962)
- [Flutter troubleshooting installation — docs.flutter.dev](https://docs.flutter.dev/get-started/install/help)
- [doctor --json exits non-zero with empty body — a11y-witness#1082](https://github.com/DanBeckDev/a11y-witness/issues/1082)
- [Flutter exit code 1 — flutter/flutter#89165](https://github.com/flutter/flutter/issues/89165)
- [brew doctor returns error exit code (1) after warning instead of (0) — Homebrew/legacy-homebrew#43879](https://github.com/Homebrew/legacy-homebrew/issues/43879)
- [Homebrew Documentation: Common Issues](https://docs.brew.sh/Common-Issues)
- [mise Troubleshooting — mise doctor](https://mise.jdx.dev/troubleshooting.html)
- [mise Configuration — precedence model](https://mise.jdx.dev/configuration.html)
- [git config list --show-origin / --show-scope precedent](https://www.theserverside.com/blog/Coffee-Talk-Java-News-Stories-and-Opinions/Use-Git-config-list-to-inspect-gitconfig-variable-settings)
- [rustup Overrides — precedence ladder and rustup show](https://rust-lang.github.io/rustup/overrides.html)
- [rustup toolchain list produces outdated information after auto-install — rust-lang/rustup#5034](https://github.com/rust-lang/rustup/issues/5034)
- [Check installed .NET versions — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/core/install/how-to-detect-installed-versions)
- [git-lfs env command / t-env.sh fixtures](https://github.com/git-lfs/git-lfs/blob/main/t/t-env.sh)
- [git-lfs Troubleshooting wiki](https://github.com/git-lfs/git-lfs/wiki/Troubleshooting)
- [npm-doctor official docs](https://docs.npmjs.com/cli/v11/commands/npm-doctor/)
- [npm doctor exit code 0 on ERR — npm/cli#1226](https://github.com/npm/cli/issues/1226)
- [asdf All Commands (no doctor command) — asdf-vm.com](https://asdf-vm.com/manage/commands.html)
- [asdf Versions — ASDF_${TOOL}_VERSION env var overrides .tool-versions](https://asdf-vm.com/manage/versions.html)
- [nvm/nvm.sh — debug command fields](https://github.com/nvm-sh/nvm/blob/master/nvm.sh)
- [nvm README](https://github.com/nvm-sh/nvm/blob/master/README.md)
- [[DOCS] CLI Reference Missing `claude doctor` Command — anthropics/claude-code#19354](https://github.com/anthropics/claude-code/issues/19354)
- [Claude Code /doctor: Fix Setup Issues in 30 Seconds — Vincent's Blog](https://blog.vincentqiao.com/en/posts/claude-code-doctor/)
- [Claude Code /doctor: the health check became a context audit — Tim Schipper](https://tim-schipper.nl/en/blog/claude-code-doctor)
- [What Does /doctor Do in Claude Code — ClaudeLog](https://claudelog.com/faqs/what-is-claude-code-doctor/)
- [Claude Code /doctor (/checkup) guide — The Prompt Shelf](https://thepromptshelf.dev/blog/claude-code-doctor-checkup-command-guide-2026/)
- Project-internal: `/home/henrik/dev/henrik/git/c64-re-tools/.planning/PROJECT.md` (v1.1.0 milestone scope, five scoping decisions)
- Project-internal: `/home/henrik/dev/henrik/git/c64-re-tools/CLAUDE.md` (never-auto-install constraint, existing five env-var overrides)
- Project-internal: `/home/henrik/dev/henrik/git/c64-re-tools/README.md` (existing per-distro install tables, the content the declaration should centralize)

---
*Feature research for: prerequisite/environment doctors and tool-location config, c64-re-tools v1.1.0*
*Researched: 2026-09-16*
