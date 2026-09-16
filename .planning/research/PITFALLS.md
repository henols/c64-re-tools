# Pitfalls Research: Adding a Prerequisite Doctor to an Existing System

**Domain:** Retrofitting a diagnostic/doctor CLI plus a user-authored tool-location config
file onto an existing, opinionated codebase (`c64-re-tools`, milestone v1.1.0 "The
Prerequisite Doctor")
**Researched:** 2026-09-16
**Confidence:** MEDIUM-HIGH — the integration pitfalls (§1, §4, §6) are grounded directly
in this repository's own source and its own documented incident history, which is stronger
evidence than a generic web survey. The generic CLI-doctor failure modes (§2, §3, §5, §7)
combine real, cited public incidents (Flutter, Homebrew) with reasoning clearly labelled as
such where no public incident was found for this exact shape of problem.

This research answers one question: **what goes wrong specifically when a doctor and a
location-config file are ADDED to a system that already has its own (undocumented,
inconsistent) detection logic** — not generic "how to write a good CLI" advice.

---

## Critical Pitfalls

### Pitfall 1: The doctor that lies — two probes, two verdicts

**What goes wrong:**
The doctor reports a tool present/absent/adequate in a way that disagrees with what the
code that actually *uses* the tool decides at run time. The user trusts the green check,
then hits a refusal the doctor never predicted (or panics over a red the real code path
never hits).

**Why it happens — the general mechanism, evidenced publicly:**
- **Different resolution algorithm than the real code path.** Flutter's doctor has
  repeatedly diverged from `flutter run`'s own toolchain resolution — e.g. doctor
  resolving a **different Java path** than the one the build actually invokes
  ([flutter/flutter#108618](https://github.com/flutter/flutter/issues/108618): *"Flutter
  doctor uses wrong path to determine the Java version: Cannot execute /wrong/path/to/java"*),
  and doctor reporting success while every real command still fails on a path error
  ([flutter/flutter#45687](https://github.com/flutter/flutter/issues/45687)).
- **Stale/cached verdict vs. a PATH that changed since.** Homebrew's `brew doctor` has a
  long history of complaining about PATH ordering that the shell/session has already
  fixed, or missing that its own install hook writes to `/etc/paths.d/homebrew`, which is
  read at a different point in shell startup than the check assumes
  ([Homebrew/brew#21334](https://github.com/Homebrew/brew/issues/21334)); doctor and the
  live command simply see different environments.
- **Caching/memoisation drift.** A resolver that memoises its answer for process lifetime
  is correct *within* a process and wrong *across* processes that started at different
  times relative to a fix. This is not hypothetical for this codebase — it is already how
  the code we are extending behaves (see next paragraph).

**Why it is a real, present risk in THIS codebase specifically (measured, not
hypothetical):**
- `backend-detect.mts`'s `resolvedBackend()` **memoises its answer for the process
  lifetime** in a module-level variable (`let memoisedResult`), by explicit design ("a
  long-running process ... resolves once per process lifetime"). A long-lived broker
  process that resolved `x64sc` before a user edits `tools.json` or fixes their `$PATH`
  will keep answering with the *old* resolution until the broker process itself restarts
  — while a doctor invocation started fresh right after the fix reports the *new* answer.
  Two truthful answers, from two different processes, both correct for their own moment —
  indistinguishable from a lying doctor to the user reading them side by side.
- `findSiblingBinary()` (`host-tool.mts`) is **also memoised per binary name for the
  process lifetime**, and its own header comment states the reasoning explicitly: *"A
  `null` (not found) answer is memoised too: a transient host misconfiguration that
  resolves differently mid-process is not a case this module has ever handled."* This is
  a documented, deliberate design choice in the exact functions the milestone plans to
  reuse — the doctor inherits this staleness property for free if it calls the same
  functions, and must not silently assume "the doctor's answer is what a fresh session
  gets" without stating that assumption.
- **The project has a real, already-recorded instance of exactly this failure class**,
  independent of memoisation: a self-built fork VICE at `/usr/local/bin/x64sc` shadowed
  genuine stock at `/usr/bin/x64sc` on `$PATH`. Every bare-name resolution (`resolvedBackend()`'s
  default `viceBin ?? "x64sc"`, the broker's default `VICE_BIN`) landed on the fork, and this
  produced a wrong conclusion in-session that was only caught by deliberately addressing the
  absolute path (`no-real-stock-vice-available` memory, 2026-08-16 supersession note: *"Anything
  claiming to test 'the stock backend' against a bare `x64sc` invocation is actually exercising
  the fork build"*). The fork is gone architecturally now (FORKRM-01), but the **shadowing shape
  is not fork-specific** — a distro package, a self-compiled build, or a stale Homebrew keg at a
  different `$PATH` position reproduces the identical failure with two *stock* builds.
- **A structural trap unique to this milestone's own hard constraint:** the doctor must run
  on a Node too old to run the server, so it **cannot simply `import` the `.ts`/`.mts` modules**
  that hold today's real probes (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`,
  `findAcmeLib()`, the Ghidra `analyzeHeadless` search) if those modules assume Node ≥ 24
  type-stripping or pull in anything that does. If the doctor's implementation responds to that
  constraint by **re-deriving its own copy** of the probe logic (a plausible, easy-looking fix),
  that is precisely "a second detection path that can disagree with the first" — the exact
  anti-pattern the milestone's own scoping note already names as *"the specific mistake to
  avoid here."* The doctor must be Node-old-safe **without** becoming a second probe
  implementation; those two constraints are in tension and the tension is the pitfall.
- **`vice_ping`'s `resolvedBinaryPath`/`binPathResolved` fields already exist as the
  "what did the real code actually resolve" ground truth** (`ResolvedBackendResult`,
  `backend-detect.mts`). Any doctor claim about x64sc that cannot be cross-checked against
  a live `vice_ping` answer, in a test, is an unverified claim about agreement, not
  verified agreement.
- The doctor also cannot reach VICE's real version string through the same channel the
  running code uses: `versionQuad` is only ever learned from a **live binary-monitor
  connection's own `REGISTER_INFO`/info response** (`stock-connect.ts`'s `resolveCapabilities()`,
  `infoResponse.versionString`) — never from a static `--version`/`--help` spawn (that
  discriminator was deliberately deleted, `backend-detect.mts`'s own header: *"the `--help`
  probe ... [is] deleted outright"*). A doctor that runs before any session exists has no live
  monitor connection to ask, so whatever it reports about the VICE *version* is necessarily a
  **different, weaker signal** (e.g. presence + `stat`) than what the real code eventually
  learns. See Pitfall 6 for the version-floor half of this.

**How to avoid (actionable):**
1. **Zero new probe implementations.** The doctor may only call the existing exported
   probe functions (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`,
   `findAcmeLib()`, the Ghidra language/analyzeHeadless search), or a thin host-bound
   `.mjs` wrapper around them compiled the same way `resources/*.mjs` already is — never a
   re-implementation with its own PATH walk or its own candidate list. If the Node-floor
   constraint makes direct import impossible for one probe, that probe's *logic* still has
   to be the single source: factor it so the doctor's old-Node-safe entry point can load it
   (e.g. a plain `.mjs`/`.cjs` module with no type-stripping dependency, imported by
   *both* the doctor and the real dispatch path) rather than hand-copying its behaviour.
2. **A same-process differential test, not a docs claim.** Add a test that calls the
   doctor's resolution for a given tool and the real dispatch-path resolution for the same
   tool, in the same process, against the same fixture PATH/env/tools.json, and asserts
   the two answers (path, and whether it resolved) are identical. Run it for every tool the
   doctor reports on. This is the only mechanism that actually catches drift between the
   two call sites when someone edits one and not the other later — a written comment saying
   "these must agree" does not survive a future edit.
3. **State memoisation staleness in the doctor's own output, not just in a comment.** Where
   the doctor's process is necessarily distinct from any running broker's process (the
   normal case, since it runs before any session), the doctor's report should not imply
   "this is what the broker will resolve *right now*" — it should say what a **fresh**
   process would resolve, and, if a broker state file already exists (`.c64-re-tools/supervisor/`),
   the doctor can additionally surface what that specific running instance last resolved,
   labelled as such, rather than presenting one merged number.
4. **Treat "the shadowing scenario" as a required fixture**, not an edge case: a test PATH
   with two same-named binaries at different priority positions, asserting the doctor names
   *which one* it picked and *why* (PATH order), because the project has already paid for
   this exact confusion once.

**Warning signs (for a reviewer):**
- A PR touching the doctor that does NOT touch `backend-detect.mts`, `host-tool.mts`, or
  their test files at all — a doctor that never imports/exercises the real probes is
  already suspicious.
- Any `find`/`resolve`/`probe`-shaped function newly added under a `doctor*` file that
  duplicates a PATH walk, a candidate-list walk, or a `existsSync` loop already present
  elsewhere.
- A doctor test that asserts against a **hand-written expected path** rather than against
  the output of the real resolver called with the same inputs.

**Phase to address:** the phase that builds the doctor's resolution/reporting core (not the
CLI shell, not the declaration data file) — this is the single highest-risk phase in the
milestone and should not be combined with unrelated scope.

---

### Pitfall 2: The doctor that cannot run

**What goes wrong:**
The diagnostic tool fails to start on exactly the broken environment it exists to explain —
either it needs the thing it is checking for, or it needs something else that happens to be
missing on a badly set up machine, and the user gets a stack trace instead of a diagnosis.

**Why it happens:**
- **Version-floor self-reference.** A doctor entry point that is a subcommand of the main
  binary inherits that binary's own runtime floor. This is a documented, named failure
  shape elsewhere: the `evlog` CLI's doctor command carries its own explicit
  `NODE_TOO_OLD` error path as a first-class case ([evlog.dev/cli/doctor](https://www.evlog.dev/cli/doctor)),
  because a generic "your Node is too old" crash (an unhandled syntax error from a
  language feature the old runtime doesn't support, or an `ERR_REQUIRE_ESM` at import
  time) is not a diagnosis — it just looks like the tool is broken.
- **Bootstrap-phase dependency mismatches** are a real, recurring class of "the installer/
  doctor cannot even start" bug — e.g. a bootstrap process failing on an `EBADENGINE`
  npm engine mismatch at its *own* setup stage before it can report anything useful
  ([NousResearch/hermes-agent#76484](https://github.com/NousResearch/hermes-agent/issues/76484)).
- **A doctor importing "the whole app."** If the doctor entry point is reached by importing
  a module that has side effects at import time (opens a socket, reads a config file that
  doesn't exist yet, requires an MCP SDK dependency tree), any one of those can throw before
  the doctor's own logic runs at all.

**Why it is a real, present risk in THIS codebase specifically:**
- Confirmed at milestone scoping time by reading `package.json`: `bin.vice-mcp` points at
  `vice-proxy.ts`, which only *parses* under Node's native type-stripping (Node ≥ 24). On
  Node < 24 this is not a graceful degrade — it is a syntax the older runtime cannot even
  parse, so any doctor implemented as "a new subcommand branch inside `vice-proxy.ts`" is
  self-defeating by construction: the one check most likely to fail (Node too old) is the
  one guaranteed to prevent that code from ever running.
- `@mastra/mcp`/`@mastra/core` and the rest of the stdio JSON-RPC framing stack are real,
  possibly Node-version-sensitive dependencies of the *server*. A doctor that imports
  `vice-proxy.ts`'s module graph even indirectly (e.g. to reuse a shared constants file that
  itself imports the MCP SDK) inherits that dependency surface for a task — "is Node old" —
  that should need none of it.
- `scripts/ensure-mcp-deps.sh` provisions `node_modules` for the *server* lazily on
  `SessionStart`; on a machine where that has never run (exactly the state the doctor is
  most useful in — before any session exists), any doctor path that resolves through
  `node_modules` for the server package can throw `MODULE_NOT_FOUND` before it reaches the
  Node-version check it was trying to report.

**How to avoid (actionable):**
1. **The doctor entry point must be its own file, with its own `bin` binding, importing
   only Node built-ins plus the narrowly-scoped resolution helpers it shares with the real
   dispatch path (Pitfall 1) — never `vice-proxy.ts`, never anything that transitively pulls
   in `@mastra/*`.** This is a structural constraint, testable by a source-level guard: a
   test that statically walks the doctor entry's import graph and fails if it reaches
   `@mastra/mcp`, `@mastra/core`, or `vice-proxy.ts`.
2. **The Node-version check must be the literal first statement executed, written in syntax
   that is valid on every Node version the doctor might run under** (i.e. no optional
   chaining assumptions beyond what the floor requires, no top-level `await` if that's a
   risk, plain `process.versions.node` string parsing) — so that when it fails, it fails
   with a clear, doctor-authored message, not a runtime parse/import error.
3. **A CI matrix cell that runs the doctor under the actual old-Node floor**, not just under
   the CI runner's normal Node — asserting exit code and a specific "Node too old" message,
   not merely "did not throw."
4. **No side-effecting import at module load time.** Every filesystem/env probe the doctor
   performs happens inside an explicitly called function, never at `import` time — so a
   probe that itself throws (e.g. `GHIDRA_HOME` set to a garbage path) cannot prevent the
   Node-version check (or any other independent check) from running and being reported.

**Warning signs:**
- `bin.vice-mcp-doctor` (or however it is registered) resolves to the same file as, or a
  file that imports, `vice-proxy.ts`.
- The doctor's own `package.json`/manifest declares an `engines.node` floor identical to the
  server's — if true, the doctor cannot report on the one condition it exists to report on.
- No test exercises the doctor with a Node binary below the floor (mocking
  `process.version` is not equivalent — the real defect class is a parse/import failure,
  which only a real old interpreter reproduces).

**Phase to address:** the phase that stands up the doctor's CLI entry point, before any
reporting logic is added on top of it. This should be verified before Pitfall 1's
resolution-sharing work begins, since the entry point's import boundaries constrain how
probe logic can be shared at all.

---

### Pitfall 3: Path/location config pitfalls — `tools.json`

**What goes wrong:**
A user-authored path in a config file behaves differently from a `$PATH`-resolved binary in
ways the resolution code doesn't anticipate: `~` never expands, a relative path resolves
against the wrong working directory (the broker's cwd, not the user's shell cwd, not the
repo root), a path points at a directory or a non-executable file and the failure surfaces
as a confusing spawn error instead of a doctor-level refusal, or the path is checked once
and used later after it has changed underneath the process.

**Why it happens (general, well-established classes):**
- **TOCTOU (CWE-367):** checking a path exists/is executable and then using it later is
  inherently racy — "a pathname is not a stable reference to a specific file object... an
  attacker [or, non-adversarially, a routine file replace] can change what the pathname
  resolves to" between check and use ([CWE-367](https://cwe.mitre.org/data/definitions/367.html);
  [Wikipedia TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)). The
  non-adversarial version of this — a package manager upgrade replacing the binary between
  the doctor's check and the broker's next launch — is the realistic case here, not an
  attacker.
- **`~` and env-var expansion are not automatic in Node.** `existsSync("~/tools/x64sc")` is
  checked *literally* — Node performs no shell-style tilde expansion — so a config value a
  user naturally types (copying a shell prompt's `~/bin/x64sc`) silently resolves to nothing
  unless the resolution code expands it itself.
- **Relative-path ambiguity.** A relative path in a config file has no inherent "resolve
  against what" — the repo root, the config file's own directory, and the process's `cwd`
  at spawn time are three different, all-plausible answers, and a config format that doesn't
  pick one explicitly will get user reports assuming each of the other two.
- **Windows suffix/separator handling** (`.exe`, `.cmd`, `\` vs `/`) is a well-known Node
  `child_process` sharp edge — a bare "does this file exist" check on Windows needs the
  right extension appended or PATHEXT-style resolution, and this project's own README
  already documents that VICE has **no package-manager route on Windows at all** — meaning
  Windows users are the population *most likely* to need `tools.json` to point at a hand-
  placed `.exe`, which is exactly the platform this class of bug hits hardest.
- **Exists-but-not-executable, and exists-but-is-a-directory** are both states `existsSync()`
  reports as true — a probe that treats "exists" as "usable" will attempt to spawn a
  directory or a non-executable file and surface a raw `EACCES`/`EISDIR` from `child_process`
  instead of the doctor's own named refusal.

**How to avoid (actionable):**
1. **Resolve `tools.json` paths through one function, with a fixed, documented base for
   relative paths (repo root via the existing `repoRoot()`/`toolsDir()` resolver — never
   the process cwd), explicit `~` expansion against `process.env.HOME`/`os.homedir()`, and
   `.exe` fallback probing only on `process.platform === "win32"`.** This function must sit
   beside `defaultResolveBinPath()`/`findSiblingBinary()`, not duplicate their shape.
2. **Verify usability, not just existence:** `statSync` and check `isFile()` (reject
   directories with a named refusal, not a spawn attempt) and, on POSIX, a mode/`X_OK`
   check via `fs.accessSync(path, fs.constants.X_OK)` — surfaced as "found but not
   executable: `chmod +x`" rather than a generic spawn failure.
3. **Do not eliminate the TOCTOU window — narrow its consequence.** The realistic risk here
   is staleness (a package upgrade), not attack, so the actionable fix is not "close the
   race" (impossible without holding a file descriptor across the whole session) but
   "detect and report the mismatch": reuse the identity fields (`mtimeMs`/`sizeBytes`)
   `backend-detect.mts`'s cache already carries for exactly this purpose (a binary "replaced
   in place" invalidates the cached identity) rather than trusting a path string forever.
4. **A path from `tools.json` must reach `spawn()` only through the existing argv-array
   call sites** (`spawnHostTool()`'s `spawn(toolPath, argv, {...})`, no `shell: true`
   anywhere in this project's spawn calls — confirmed by reading `host-tool.mts`). This is
   already the house invariant (CLAUDE.md: *"argv array, never a shell command string"*);
   the new risk `tools.json` introduces is a **user-controlled** string reaching that argv
   array for the first time (previously it was env-var-controlled, same trust level, so this
   is not a *new* trust boundary — but it is worth a regression test asserting a path
   containing shell metacharacters (`; rm -rf`, `$(...)`, backticks) is passed through to
   `spawn`'s argv unchanged and never concatenated into a string anywhere in the call chain).
5. **Symlinks:** resolve them explicitly (`fs.realpathSync`) only when the identity check in
   (3) needs a stable target to compare against; do not silently follow a symlink and then
   report the *link's* path back to the user as "where the tool is" — report what the user
   typed AND what it resolved to, the same two-field pattern (`binPath`/`binPathResolved`)
   `backend-detect.mts` already uses for `x64sc`.

**Security question — is a repo-local `tools.json` a code-execution vector?**
Analysis, not a citation (this is project-specific reasoning):
- `.c64-re-tools/` is gitignored (`.gitignore` lines 20/26), and the plugin/npm release
  artifacts are built via `git archive HEAD`, which only ever includes **tracked** files —
  so an untracked `tools.json` cannot ship inside a release by ordinary means. This *does*
  mitigate "a malicious repo ships a poisoned `tools.json` that a fresh clone silently
  trusts" — there is no committed file to poison.
- It does **not** fully mitigate the file as a vector, for two reasons that are still real:
  (a) a user (or a compromised dependency's postinstall, or a careless `git add -f`) *can*
  force-add it despite `.gitignore`, and gitignore is a convention, not an access control —
  a reviewer diffing a PR should treat any tracked `.c64-re-tools/tools.json` as an
  immediate hard stop; (b) even untracked, `tools.json` is still an **attacker-writable
  file on a shared or CI-adjacent machine** if anything else with write access to the repo
  checkout (another tool, a build step, a compromised editor extension) can write it — the
  resolution code should therefore treat every path it reads from `tools.json` with the same
  suspicion as an env var, i.e. it is data, not code, and must never be `eval`'d,
  interpolated into a shell string, or used to construct anything beyond an argv-array spawn
  target and a `existsSync`/`statSync` check.
6. **Structural mitigation, testable:** a guard test asserting `tools.json` values are only
   ever passed to `fs.*` path functions and `spawn()`'s argv array — grep-shaped is
   acceptable here (assert the resolution module contains no `exec(`, `execSync(`, template
   literal building a command string, or `shell: true`).

**Warning signs:**
- Any `tools.json` value reaching a template string (`` `${bin} --version` ``) anywhere.
- A relative-path test that only exercises "run from repo root" — the ambiguous case is
  "run from somewhere else," which is the normal case for a globally-installed CLI.
- No test for "path exists, is a directory" or "path exists, is not executable" as distinct
  refusal messages from "path does not exist."

**Phase to address:** the phase that implements `tools.json` resolution (layered under env
vars, per the milestone's own decision 5) — this is a self-contained module and should ship
with its own focused test file before the doctor's reporting layer consumes it.

---

### Pitfall 4: Layered-precedence pitfalls — env → file → `$PATH`/sibling → refuse

**What goes wrong:**
With four possible sources for one resolved path, the two most common failures are (a) a
lower-priority source silently wins because the precedence check has a bug, and (b) the user
genuinely cannot tell *which* source supplied the answer they are looking at, so a correct
answer still reads as unexplained.

**Why it happens:**
- **Precedence differing between two code paths in the same product is the single most
  damaging version of this** — because it means "which source wins" is not even one true
  fact, it is two facts that happen to usually agree. This is precisely the shape of
  Pitfall 1, applied to precedence specifically rather than to resolution generally: if the
  doctor's precedence order is `env → file → PATH/sibling → refuse` but the real dispatch
  path's precedence (once `tools.json` is wired into it) ends up being `file → env → ...`
  because of where the wiring was inserted relative to an existing `env.VICE_BIN ?? "x64sc"`
  default, the doctor becomes actively wrong rather than merely stale.
- **A config file overriding a deliberate one-shot env override** is a real, named UX
  failure in exactly this precedence shape elsewhere — `tbd`'s doctor had to be patched
  specifically because it warned about PATH state that an env-based, single-invocation
  override had already deliberately fixed for that run
  ([jlevy/tbd#248](https://github.com/jlevy/tbd/pull/248): *"doctor warns when npm's global
  bin is off PATH"* despite the running session already being correctly configured). The
  general lesson: a persistent, file-based source and a transient, per-invocation source are
  not interchangeable, and putting the persistent one *above* the transient one in precedence
  (or reporting on the persistent one when the transient one is what's actually live) produces
  a doctor that argues with a decision the user just made on purpose.
- **Stale cached resolution outliving a precedence change** — see Pitfall 1's memoisation
  discussion; it applies identically here, compounded, because now there are four things
  that could have changed (env unset, file edited, PATH reordered, sibling binary replaced)
  instead of one.
- **This project's own real, already-documented instance is directly on point** (repeated
  here because it is precedence-shaped, not just resolution-shaped): the fork-vs-stock
  `x64sc` shadowing on `$PATH` meant that even when `VICE_BIN` was *unset* (so PATH
  resolution should be the deciding source), the answer a reader got depended entirely on
  which of two real, valid binaries happened to sit first in `$PATH` — an ordering fact
  invisible from the resolved absolute path alone unless the tool explicitly surfaces "PATH
  order" as the reason. `backend-detect.mts`'s `binPath`/`binPathResolved` fields answer
  "what did it resolve to," never "why this one and not the other."

**How to avoid (actionable):**
1. **One resolver function, called by both the doctor and the real dispatch path** — this
   is the same structural fix as Pitfall 1, and it is what makes "precedence differs between
   two code paths" structurally impossible rather than merely discouraged. If the Node-floor
   constraint truly forces two call sites, the precedence LOGIC itself (the ordered list of
   sources, as data — e.g. `["env:VICE_BIN", "file:tools.json#x64sc", "path", "sibling"]`)
   must be a single exported constant/table both call sites iterate, never two independently
   written `if/else if` chains.
2. **The resolved answer always carries its source, as a first-class field** — not
   reconstructed after the fact by re-checking each layer, but recorded at the moment of
   resolution (`{ path, source: "env" | "file" | "path" | "sibling", tried: [...] }`), so
   "why did I get this answer" is answered by the resolver itself, in every consumer,
   including the doctor's report and any refusal message. `findSiblingBinary()`'s existing
   `tried: string[]` return shape and its logged PATH-fallback warning are the right
   precedent to extend, not replace.
3. **A precedence conformance test matrix**: for every pair of sources (env set + file set,
   file set + PATH match, PATH match + sibling match, all four set), assert the winner is
   the one the documented precedence says and that the *source label* on the result matches.
   This test should exist once, and both the doctor and the real dispatch path should be
   asserted against it (see (1)) — not two separate test files that could each pass while
   disagreeing with each other.
4. **Do not let `tools.json` shadow a same-run env override.** Per the milestone's own
   decision 5, env vars are *above* the file in precedence — verify this is true not just in
   the written precedence order but in the actual resolver code path, with a test that sets
   both `VICE_BIN` and a conflicting `tools.json` entry and asserts the env var wins.

**Warning signs:**
- A resolved answer with no `source` field, or one only reconstructable by the caller
  re-probing each layer itself.
- Doctor and dispatch-path precedence described in prose in two different files
  (`doctor.md`-shaped comment in one, `stock-dispatch.ts`-shaped comment in the other)
  rather than one shared, imported list.
- No test exercising the "PATH has two valid matches at different positions" case — this
  project has already been burned by exactly this scenario once.

**Phase to address:** should be delivered together with Pitfall 3's `tools.json` resolution
phase — precedence is a property of the resolver, not a separate feature, and splitting them
across phases risks exactly the "two code paths disagree" failure this pitfall describes.

---

### Pitfall 5: Generated-documentation drift, without a byte-identical guard

**What goes wrong:**
A README section generated from a declaration drifts from that declaration, and the guard
meant to catch it either (a) never actually fails under a real drift (vacuous), (b) fails on
harmless formatting noise unrelated to content (too strict, trains reviewers to ignore red
CI), or (c) is never exercised in CI because the generator itself is only ever run by hand.

**Why it happens (general):**
- **The specific failure of "testing the generator against itself."** A drift guard that
  regenerates the section and diffs it against what's on disk is only meaningful if the
  generator is independent of whatever broke — if the same bug that produced wrong README
  content also produces the "expected" value the guard diffs against (because both read the
  same broken intermediate value, or the guard literally re-invokes the generator and
  compares its output to itself rather than to the committed file), the guard is
  structurally unable to fail. This is the generated-docs analogue of a unit test whose
  expected value is derived from the same code path as the actual value under test — this
  project's own `ENGINEERING_RULES.md` §5 already bans exactly this shape ("tests ... derive
  their expected value from the same live source that produced the input under test") for
  code; the same discipline has to extend to the new drift guard or it inherits the
  loophole.
- **Guards not run in CI** is the most common real-world failure — a generator with a
  correct guard that only runs via a manual `npm run docs:check` script nobody remembers to
  invoke is equivalent to no guard the moment someone forgets.
- **Byte-identical guards are too strict for a Markdown table hand-adjacent to prose** — this
  is exactly why the owner removed all byte-identical assertions on 2026-09-13 (Phase 54,
  "including the three tree-sync guards"). A new byte-identical README guard would rebuild
  the specific thing that decision deleted, and would also be the wrong tool for the job
  even on its own merits: it reds on a trailing-whitespace fix, a reflowed sentence next to
  the generated block, or a heading-level change — none of which are drift.

**Why the shape matters specifically for THIS project:**
This project already has the correct discipline for a *different* generated-artifact pair
(`.mts` sources → committed `resources/*.mjs`), enforced by `resources-sync.test.ts`, and
`CLAUDE.md` states it plainly: *"`resources-sync.test.ts` fails CI on drift."* That guard
is allowed to be byte-identical because its artifact (compiled `.mjs`) has no legitimate
reason to differ from its generator's output by even one byte. A generated **README
section** is different in kind: it lives inside a hand-written document, so "drift" has to
mean "the generated facts disagree with the declaration," not "the bytes differ" — the
declaration-to-README relationship is a **referential-integrity** property, not an
**identity** property, and the guard shape has to match that.

**How to avoid — the concrete recommended shape:**
1. **Bracket the generated section with explicit, machine-findable markers** in `README.md`
   (e.g. `<!-- BEGIN GENERATED: prerequisites -->` / `<!-- END GENERATED: prerequisites -->`),
   so the guard can extract exactly the generated slice without depending on surrounding
   prose staying put.
2. **The guard regenerates into memory from the committed declaration, then parses BOTH the
   regenerated text and the extracted committed slice back into structured data** (e.g. an
   array of `{ tool, versionFloor, unblocks: [...], remedy: { platform: string } }` records)
   using the same Markdown-table-to-object parser on both sides — **never a raw string/byte
   diff of the two texts.** Assert **set/record equality** on the structured data (order-
   insensitive where order isn't semantically meaningful, whitespace-insensitive
   everywhere). This is what makes the guard non-byte-identical while still non-vacuous: it
   is sensitive to a changed version floor, a changed remedy string, a missing tool, an
   extra tool — and *insensitive* to reflowed prose, trailing whitespace, or heading style.
3. **The guard must run the real generator, in CI, against the real committed declaration
   file** — not a fixture copy of the declaration and not a hand-written "expected" table.
   This closes the "generator never run in CI" failure and the "testing against itself"
   failure simultaneously: the input (declaration) and the comparison target (committed
   README slice) are two genuinely independent artifacts on disk; only the *transform*
   (declaration → structured facts, README slice → structured facts) is shared code, and
   that is fine — the two parses start from different source text.
4. **Apply `ENGINEERING_RULES.md` §6 (non-vacuous verification) to this guard explicitly**,
   as a required step, not an optional nice-to-have: plant a violation (hand-edit the
   committed README's remedy string for one tool without regenerating; separately, hand-edit
   the declaration's version floor without regenerating) and confirm the guard fails BOTH
   times, with two separate test cases. A guard that has never been observed failing is not
   evidence it can fail.
5. **This is a real, direct tension worth surfacing to the roadmapper explicitly**:
   `ENGINEERING_RULES.md` §11 currently says *"Generated documentation should use
   scratch-generation plus byte-diff or an equivalent deterministic drift check where
   practical"* — written before the 2026-09-13 byte-identical removal decision, and not yet
   reconciled with it. The structural-diff shape above is the *"equivalent deterministic
   drift check"* §11 already anticipates as an alternative, so no rule conflict actually
   exists once §11 is read as offering a choice — but §11's own text should be updated (or a
   note added) so a future reader does not see "byte-diff" and "no byte-identical
   assertions" as contradictory in this specific area.

**Warning signs:**
- A `docs-prereq-drift.test.ts` (or similarly named) guard whose failure message is a raw
  string diff rather than a named field (`"acme-build: version floor mismatch: declared
  0.97, README says 0.96"`).
- The guard imports the generator and calls it, then compares the result **to itself** or to
  a second in-memory generation, rather than to the actual `README.md` file on disk.
- No CI step invokes the generator/guard at all — only a `package.json` script a human has
  to remember.
- The guard was never observed red (no commit history, no test-of-the-test) — this is
  disqualifying under §6, not merely a nice-to-have.

**Phase to address:** the phase that adds the generated README section, delivered together
with its guard in the same phase (never generator-now-guard-later) — and the guard's
non-vacuousness must be demonstrated as part of that phase's own verification, per
`ENGINEERING_RULES.md` §6/§18.

---

### Pitfall 6: Version-floor pitfalls

**What goes wrong:**
Parsing a tool's version turns out to be far less reliable than it looks: the string is on
the wrong stream, the tool hangs, the tool needs a TTY, a distro repackages the version
string in a way the parser doesn't expect, or — the deepest version of this pitfall —
"present at version N" and "actually works for what we need" are different questions that a
version check alone cannot answer.

**Why it happens (general, well-established):**
- **stderr vs. stdout.** The canonical example is `java -version`, which has written its
  version banner to **stderr**, not stdout, since Java's earliest releases — any doctor
  that only captures stdout on a `--version`/`-version` spawn silently gets an empty string
  from a tool that is actually present and working.
- **Non-zero exit for `--version`.** Some CLIs treat `--version` as an error path and exit
  non-zero even though they printed the right thing — a doctor that gates on exit code
  before reading output discards a correct answer.
- **TTY requirements / hangs.** A tool whose interactive mode activates on a bare invocation
  (no args recognized) can hang waiting for stdin if the doctor's spawn doesn't close stdin
  or set a timeout — turning a fast diagnostic into a wedged process.
- **Distro-patched version strings.** Package maintainers routinely append build metadata
  (`3.9+dfsg-1`, as this project's own README already documents for VICE on Debian) — a
  parser expecting a bare semver-shaped string will either fail to parse or, worse,
  misparse the suffix as part of the version and compare wrong.
- **"Present" vs. "works" is the deepest version of this pitfall**, and it is not really a
  parsing problem — a tool can be installed, on `$PATH`, and report a version string that
  satisfies the floor, and still not work for the specific thing the code needs (missing a
  compiled-in feature, missing a runtime dependency, wrong build flags).

**Why this is already a *measured, known* case in THIS codebase — and the project has
already learned the exact lesson the question anticipates:**
- `CPUHISTORY_GET` (the binary-monitor opcode) needs VICE ≥ 3.10; Debian/Ubuntu ship 3.9.
  This is a genuine, real version floor.
- **But the project already discovered that gating on the VICE version string is the wrong
  tool for this specific floor**, because the equivalent *capability* is reachable a
  different way on stock 3.9 (the `chis` text-monitor command, over the text channel,
  independent of the binary-monitor opcode's version gate) — documented in `CLAUDE.md`'s own
  dependency bullet: *"the version floor is on the opcode, not the capability... text-command
  tracing/profiling support is opt-**out** at build time, the opposite of a version floor."*
  In other words: for this exact tool, a naive "check the version string, refuse below 3.10"
  doctor answer would have been **actively wrong** — it would refuse a capability that is, in
  fact, available through a different route on the same binary.
- **The mechanism that resolves VICE's version today is not a static probe at all** — it is
  read from a live binary-monitor connection's own info response
  (`stock-connect.ts`'s `resolveCapabilities()`, `infoResponse.versionString`), and the
  static `--help`-based discriminator that used to exist was **deliberately deleted**
  (`backend-detect.mts`'s header comment) once it stopped being needed for backend
  discrimination. This means the doctor — which by design runs before any session/connection
  exists — has **no existing static version-probing code to reuse for VICE at all**. Whatever
  the doctor does to report on VICE's version is necessarily NEW code, which raises Pitfall 1
  again: a new, doctor-only version probe for `x64sc` is a second source of truth about VICE's
  version, alongside the live-connection one the real dispatch path uses, and the two can
  disagree (e.g. the doctor spawns `x64sc --help`/`-verbose` and parses a version banner from
  a build whose actual live-negotiated `versionString` differs, or a build with a `--help` text
  format the doctor's parser doesn't expect).

**How to avoid (actionable):**
1. **Capture both stdout and stderr on any `--version`-shaped spawn**, and accept either
   exit code, consistent with the "present vs. works" distinction — the doctor's job here is
   narrower than the real dispatch path's: report identity/presence, not full capability.
2. **Do not gate any doctor verdict on a version comparison where a capability probe already
   exists and is cheaper to state honestly as "unknown until a live check."** For VICE
   specifically: the doctor should report **presence** (found at path X) and, where the
   declaration records it, the **documented package-manager version for the detected
   platform** (i.e. "if you installed via `apt`, expect 3.9, which does NOT include
   CPU-history over the binary-monitor opcode — it may still be reachable via the text
   channel; the MCP tool surface will tell you if it isn't") rather than attempting to parse
   a live version string the doctor has no connection to observe. This keeps the doctor
   truthful by construction: it never claims a version-gated capability verdict it cannot
   actually observe.
3. **Timeout every version-probing spawn** (the project's own `spawnHostTool()` already has
   a documented hard ceiling on stdout/stderr accumulation and an applied timeout budget —
   the doctor's own probes, if any spawn a `--version`, must use the same discipline, not a
   bespoke unbounded spawn).
4. **Treat the declaration's version-floor field as informational text for the human, not as
   a live-comparable value the doctor computes and asserts pass/fail on**, unless a specific
   tool's version can genuinely be checked cheaply and statelessly (e.g. ACME, `c1541`,
   `petcat`, `dxa`, Ghidra — none of which need a live emulator connection the way VICE's
   capability gate does). Apply the "capability beats version" lesson **per tool**, not as a
   blanket policy — VICE is the one tool in this set where it is already proven necessary.

**Warning signs:**
- A doctor check for VICE that reports "CPU history: unavailable" based on a parsed version
  string alone, with no caveat that the text-channel route may still work.
- A version-parsing regex tested only against one clean, un-suffixed version string, never
  against a distro-suffixed one (`3.9+dfsg-1`) or a `--help`-banner shape.
- Any doctor spawn without an explicit timeout.

**Phase to address:** the phase that writes the prerequisite declaration (version-floor
field semantics decided there) and the phase that implements the doctor's reporting for
VICE specifically — flag the VICE row for extra review given it is the one case already
proven to need capability-over-version reasoning.

---

### Pitfall 7: Scope creep — the doctor that starts fixing things

**What goes wrong:**
A doctor that can *see* what's missing is one small, natural-feeling step from a doctor that
*offers* to fix it — write the `tools.json` template automatically and silently, run
`brew install` "just this once because it's obviously right," or auto-detect and pin a path
without the user ever looking at it. Each of these individually looks like a UX improvement
and each one crosses the project's explicit, non-negotiable "never auto-install" line.

**Why teams cross this line, generally and here specifically:**
- The pull is structural, not carelessness: a doctor's entire value proposition is "tell me
  what's wrong," and the very next sentence a user says is always "so fix it" — the feature
  request writes itself, and a doctor's own author is the person most primed to say yes,
  because they already have the detection logic and installing feels like "just one more
  branch."
- **In this specific codebase, the line has already been drawn precisely, with an accepted
  positive pattern to follow** (CLAUDE.md's Dependency bullet): *"detect, then refuse by name
  with the remedy in the message"* — and the milestone's own scoping notes reinforce this is
  not up for re-litigation (*"The never-auto-install rule holds unchanged, and its three
  carve-outs stay"*). The risk is not that a planner argues against this rule; it's that an
  *implementation* detail quietly slides across it without anyone framing it as a decision —
  e.g. "the doctor writes a *default* `tools.json` with guessed paths pre-filled" is not
  package-manager invocation, so it doesn't trip the obvious tripwire, but it *does* silently
  assert unverified facts into a config file the user might not review before it starts being
  trusted as ground truth.
- **The milestone's own text already names the one place this could creep in**: *"The doctor
  writes a commented template on request; the user edits it."* "On request" and "commented
  template" (i.e. containing guidance/placeholders, not asserted real paths) are the load-
  bearing words — a version that writes real, unreviewed, auto-detected paths into
  `tools.json` without an explicit user action has quietly become an auto-configuration
  feature, which is a smaller step from auto-install than it looks.

**How to avoid — structural, not documentary:**
1. **The doctor process must have zero code paths that spawn a package manager, `curl`,
   `git clone`, or any other acquisition tool.** This is enforceable exactly like the
   project's own existing discipline elsewhere (CLAUDE.md already documents this as a
   maintained invariant for the rest of the codebase — extend the same guard to the doctor):
   a source-level test that scans the doctor's module(s) for `apt`, `brew`, `pacman`, `npm
   install`, `pip install`, `curl`, `wget`, `git clone` as literal strings and fails if found
   anywhere outside a remedy *message* (i.e. the strings may appear in a string constant
   printed to the user, never as an argument to `spawn`/`exec`).
2. **Template writing requires an explicit, separate CLI invocation** (e.g. `vice-mcp doctor
   --write-template`), never a side effect of the plain `vice-mcp doctor` read-only report —
   so "doctor was run" and "doctor wrote a file" are two distinctly-audited actions, and a
   test can assert the plain invocation never touches the filesystem for writes.
3. **The written template must contain no asserted real paths for anything the doctor merely
   guessed** — only commented-out example lines and the genuinely-detected sibling/PATH
   results the existing probes already surface with high confidence (i.e. reusing Pitfall 1's
   single resolver, not a new guessing heuristic). If the doctor cannot *prove* a path via the
   existing probe machinery, it does not pre-fill it.
4. **Doctor output is read-only with respect to the filesystem by default; the ONE write path
   (the template) is the one explicitly named exception, and should be implemented as a
   clearly separate module from the reporting logic** — so a future contributor adding, say,
   "auto-detect Ghidra and pin it in tools.json for you" has to consciously add a new write
   path rather than extend an existing one that already writes.

**Warning signs:**
- Any diff touching the doctor that adds a `child_process.spawn`/`exec` call targeting
  anything other than the six prerequisite tools' own `--version`/identity probes.
- A `tools.json` template that ships with real filesystem paths already filled in, rather
  than commented examples plus only what the existing probes actually proved.
- Doctor behavior changing based on a flag that defaults to "on" for anything that writes or
  installs — the never-auto-install posture requires defaults to be the safe/inert choice.

**Phase to address:** applies across every phase that touches the doctor's write surface;
enforce it as a standing guard test added in the same phase that first gives the doctor any
filesystem-write capability (the template-writing phase), not deferred to a later cleanup.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Doctor re-implements a probe instead of importing/sharing it (to dodge the Node-floor import constraint) | Ships faster, sidesteps a real packaging problem | Becomes a second, driftable source of truth (Pitfall 1) — the single worst outcome this milestone can produce | Never — solve the Node-floor import problem directly (a shared `.mjs`/`.cjs` module), do not accept a duplicate |
| Byte-identical drift guard for the generated README (reverting the 2026-09-13 decision) | Simple to write, obviously correct-looking | Reds on every unrelated prose edit near the generated block, trains reviewers to ignore CI red, and directly contradicts a recorded owner decision | Never for this artifact — acceptable only for artifacts with zero legitimate byte variance (e.g. compiled `.mjs`, which already has its own guard) |
| `tools.json` resolution skips `~`/relative-path/executable-bit handling "for v1" | Smaller diff, ships sooner | The very users who need `tools.json` (unusual install locations) are disproportionately the ones who hit these edge cases first | Acceptable only if explicitly scoped out in writing and the doctor's refusal message for each unhandled case is still honest (not silently treated as "not found") |
| Doctor's VICE version reporting parses a static `--version`/`--help` spawn to approximate the live-negotiated `versionString` | Doctor can say something about version without a live connection | Two version sources that can disagree (Pitfall 1 + 6); risks repeating the "version gates a capability that's actually reachable another way" mistake the project already made once | Acceptable only if framed explicitly as "expected version for your platform," never as a live-verified capability verdict |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|--------------------|
| `resolvedBackend()` / `findSiblingBinary()` (existing probes) | Doctor calls them but doesn't account for their per-process memoisation, reporting a stale "fixed!" or stale "still missing" answer | Doctor either runs in a fresh process each invocation (true today, since it's a separate CLI run) and states clearly it reflects a fresh resolution, not a running broker's cached one; add a differential test (Pitfall 1) |
| Ghidra's `analyzeHeadless` search | A second, doctor-only search for the binary that doesn't match `ghidra-project.mts`'s existing logic (which already has documented, fragile symlink/dot-path handling) | Doctor imports and calls the exact same exported search function; never re-derives the candidate list |
| `VICE_BIN`/`ACME_BIN`/`GHIDRA_HOME`/`VICE_BROKER_NODE` env vars | New `tools.json` precedence logic implemented inline at each of the 3+ existing call sites, independently, producing 3 slightly different precedence orders | One resolver function/table (Pitfall 4), imported at every call site — including the pre-existing ones, which should be refactored onto it rather than left as a fourth, un-migrated precedent |
| Generated README section | Guard regenerates and diffs the whole README file, so any unrelated prose edit anywhere in the file reds CI on an unrelated PR | Guard extracts only the marked generated slice (Pitfall 5); unrelated README edits never touch the guard |
| `c1541`/`petcat` (no location override today) | Doctor adds a `C1541_BIN`/`PETCAT_BIN` env var as a new, doctor-specific mechanism instead of only exposing sibling-probe results for tools with no override | Doctor reports sibling-probe results for these two as today; only `tools.json` (not new env vars) is the milestone's stated mechanism for the tools that currently have none |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Doctor spawns a `--version` probe per tool with no timeout, one of the six tools hangs (e.g. a broken/interactive build) | `vice-mcp doctor` itself appears to hang — ironic, since diagnosing hangs is this project's other standing pain point (`vice-wedge-triage`) | Every probing spawn uses the same timeout discipline `spawnHostTool()` already enforces; doctor never blocks indefinitely on any single tool, and reports "timed out probing X" as its own distinct status | Any tool whose bare/`--version` invocation can block on stdin or a slow first-run cache build |
| Doctor re-probes Ghidra's language directory (a real directory walk) on every invocation with no caching, and a user runs it repeatedly during setup | Doctor feels slow specifically during the "keep re-running doctor while fixing things" loop it's designed for | Cheap, per-run probes only; if any probe is genuinely expensive, cache within the single invocation (not across invocations — see Pitfall 1 on cross-process staleness) | Only matters if a probe crosses roughly human-noticeable latency (>~200ms); most of the six tools are cheap existence checks |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `tools.json` value reaches a shell string (via a future refactor that "simplifies" spawn to a template string) | Shell injection from a user- or attacker-writable config file | Structural guard (Pitfall 3 #6): scan for `exec(`/`shell: true`/template-string command construction; keep argv-array `spawn()` the only call shape |
| Doctor's `--write-template` (or equivalent) writes without prompting, and pre-fills unverified guessed paths | A wrong or malicious pre-filled path gets trusted as ground truth without review | Explicit invocation required; only proven (probe-confirmed) paths pre-filled, everything else stays a commented example (Pitfall 7) |
| A tracked (force-added) `.c64-re-tools/tools.json` ships in a clone/fork | A path an attacker controls gets treated as a trusted local override by anyone who clones that fork | Not preventable purely in code (gitignore is convention, not enforcement) — the mitigating control is the existing house discipline that `tools.json` values are treated as untrusted data (existence/executable checks + argv-array spawn only, same posture as an env var), not that the file can never be committed |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Doctor reports a flat pass/fail per binary | User can't tell what they actually lose by not fixing it | Capability-mapped output (already decided, milestone decision 4) — report per skill/MCP capability, not per binary |
| Doctor reports a resolved path with no source | User can't tell if PATH, the file, or an env var supplied the answer, and can't explain a surprising result to themselves | Always show the winning source and the full `tried:` list (Pitfall 4), matching `findSiblingBinary()`'s existing warning-log precedent |
| Doctor's VICE version story reads as a hard pass/fail on a version number | User believes CPU-history is simply unavailable on their 3.9 install, when the text-channel route may still cover it | State the capability-over-version nuance explicitly for VICE (Pitfall 6) rather than compressing it into a version comparison |
| Template-writing silently overwrites an existing, user-edited `tools.json` | Loses hand-authored config with no warning | Refuse to overwrite an existing file by name (consistent with the project's own "detect, then refuse by name" house style) unless an explicit `--force`-shaped flag is given |

## "Looks Done But Isn't" Checklist

- [ ] **Doctor resolution logic:** Often "looks shared" but is actually a parallel
      implementation — verify with a same-process differential test against the real
      dispatch path (Pitfall 1), not by reading the code and agreeing it "looks the same."
- [ ] **Doctor entry point:** Often "looks Node-floor-safe" but still transitively imports
      something that pulls in `@mastra/*` or `vice-proxy.ts` — verify by actually running it
      under the real floor Node binary in CI, not by inspection.
- [ ] **`tools.json` resolution:** Often "handles paths" but only tested against the happy
      path (absolute, existing, executable file) — verify against `~`, relative, directory,
      non-executable, and (on Windows) missing-`.exe` cases explicitly.
- [ ] **Precedence order:** Often "documented" in prose in two places but not backed by one
      shared, tested table — verify the doctor and the real dispatch path are provably using
      the same ordered list, not two lists that happen to agree today.
- [ ] **Generated README guard:** Often "exists" but has never been observed failing —
      verify with a planted-violation test per `ENGINEERING_RULES.md` §6 before trusting it.
- [ ] **Never-auto-install boundary:** Often "respected" in the obvious cases (no `apt`
      call) but crossed quietly via unreviewed template pre-fill — verify the template-write
      path only asserts probe-proven facts.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Doctor and real dispatch path disagree, discovered post-ship | MEDIUM | Add the differential test retroactively (Pitfall 1); it will immediately show which of the two is wrong; fix the divergent one to call the shared resolver, do not patch the symptom |
| Generated-docs guard found vacuous (never actually reds) | LOW | Plant a violation, confirm it fails; if it doesn't, the guard is comparing generator output to itself — fix it to compare against the actual committed `README.md` slice (Pitfall 5) |
| `tools.json` found to be trusted uncritically (e.g. reaches a shell string somewhere) | MEDIUM-HIGH | Audit every consumer of the resolved path for string-interpolation into a command; replace with argv-array `spawn()`; add the structural grep-guard so it cannot regress |
| Doctor discovered to silently pre-fill unverified paths in a written template | LOW-MEDIUM | Restrict template output to probe-proven facts plus commented examples; add a test asserting the template never contains a path the probe layer didn't return |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. The doctor that lies | Doctor resolution/reporting core phase | Same-process differential test: doctor's answer vs. real dispatch path's answer, for every probed tool, under shared fixtures |
| 2. The doctor that cannot run | Doctor CLI entry-point phase (built before reporting logic) | CI matrix cell running the doctor binary under the actual old-Node floor; static import-graph guard excluding `@mastra/*`/`vice-proxy.ts` |
| 3. Path/location config pitfalls | `tools.json` resolution phase | Fixture matrix: `~`, relative, directory, non-executable, Windows `.exe`-missing cases; grep-guard for shell-string construction |
| 4. Layered-precedence pitfalls | Same phase as #3 (precedence is a resolver property, not separate) | Precedence conformance matrix (env×file×path×sibling combinations) asserted identical between doctor and dispatch path |
| 5. Generated-documentation drift | Generated-README phase, guard delivered in the same phase as the generator | Structural (parsed-record) diff guard; planted-violation test per `ENGINEERING_RULES.md` §6, both on declaration-side and README-side edits |
| 6. Version-floor pitfalls | Declaration-authoring phase (semantics) + doctor VICE-reporting phase (implementation) | Test asserting the doctor never claims a version-gated capability verdict it has no live connection to observe; distro-suffixed version-string fixture |
| 7. Scope creep toward auto-fixing | Whichever phase first gives the doctor any filesystem-write capability | Source-scan guard for package-manager/acquisition-tool invocation strings used as spawn targets; test asserting plain `doctor` (no flag) never writes |

## Sources

- [flutter/flutter#108618 — doctor resolves a different Java path than the real build](https://github.com/flutter/flutter/issues/108618)
- [flutter/flutter#45687 — doctor reports success while every real command fails on a path error](https://github.com/flutter/flutter/issues/45687)
- [Homebrew/brew#21334 — brew doctor PATH complaint diverging from actual shell state](https://github.com/Homebrew/brew/issues/21334)
- [jlevy/tbd#248 — doctor warns despite a deliberate, already-correct one-run PATH override](https://github.com/jlevy/tbd/pull/248)
- [evlog doctor CLI reference — explicit NODE_TOO_OLD error path](https://www.evlog.dev/cli/doctor)
- [NousResearch/hermes-agent#76484 — bootstrap installer failing on its own npm engine mismatch before it can diagnose anything](https://github.com/NousResearch/hermes-agent/issues/76484)
- [CWE-367 — Time-of-check Time-of-use (TOCTOU) Race Condition](https://cwe.mitre.org/data/definitions/367.html)
- [Wikipedia — Time-of-check to time-of-use](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)
- **This repository, read directly as primary evidence** (not web sources): `src/mcp/vice/backend-detect.mts` (per-process memoisation of `resolvedBackend()`, deleted `--help` discriminator, `binPath`/`binPathResolved` fields), `src/mcp/vice/host-tool.mts` (`findSiblingBinary()` per-name memoisation and its own stated staleness rationale, `findDxaBinary()`/`findAcmeLib()` candidate-list pattern, `spawnHostTool()`'s argv-array-only spawn discipline and timeout ceiling), `src/mcp/vice/stock-connect.ts` (`versionQuad` sourced only from a live connection's `infoResponse.versionString`), `src/mcp/vice/ghidra-project.mts` (existing Ghidra probe/refusal machinery), `README.md` (per-distro VICE version/CPU-history table, the exact shape the generated section will mirror), `CLAUDE.md` (never-auto-install rule and its three named carve-outs, argv-array spawn invariant, `.c64-re-tools/` gitignore/tool-root discipline), `.planning/ENGINEERING_RULES.md` §5/§6/§11 (same-source test-derivation ban, non-vacuous verification requirement, the pre-2026-09-13 byte-diff guidance this research reconciles), `.planning/PROJECT.md`'s "Current Milestone: v1.1.0" section (the five scoping decisions, the doctor's Node-floor constraint measured at scoping time, the five-override-three-naming-convention census), and this Claude Code instance's own project memory `no-real-stock-vice-available.md` (the fork-vs-stock `x64sc` `$PATH`-shadowing incident, 2026-08-16, cited throughout §1 and §4 as this project's own real, prior instance of the exact failure class both sections describe).

---
*Pitfalls research for: retrofitting a prerequisite doctor and tool-location config onto `c64-re-tools`*
*Researched: 2026-09-16*
