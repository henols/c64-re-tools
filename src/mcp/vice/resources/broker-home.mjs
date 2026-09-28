// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-home.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/local/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-home.mts
//
// The ONE authoritative place for the machine-level root a broker writes its
// own state under, and every directory derived from it (BROKER-06, D-13,
// D-14). This is HOST-BOUND, compiled by build.ts into resources/, because
// only the long-lived broker process -- never a per-project client -- may
// WRITE anywhere under this root: epoch records, incidents,
// staging and config scratch are all written by the broker alone, and that
// write ownership is BROKER-06's whole content.
//
// A same-machine client READS through this module -- never writes -- to
// share the broker's capability record: vice-proxy.ts imports
// `brokerStateDir()` directly (this module carries only `node:` imports, so
// it loads unbuilt there too) rather than recomputing a second answer that
// could drift. A client inside a devcontainer resolves its OWN home, which is
// not the host broker's, so it simply misses that cache.
//
// WHY NOT repo-root.ts's toolsDir()/supervisorDir(). Those resolve a
// directory INSIDE whichever project checkout happens to be current
// (`join(repoRoot(...), ".c64-re-tools")`) -- exactly the per-project
// binding one-broker-per-machine removes. The incident this file exists to
// prevent: a broker started from project A must not leave its supervisor
// state, its incident records or its run scratch inside project A's tree,
// where project B's session cannot see them and where a `git clean` in
// project A destroys them. This module's root is anchored to the user's
// home directory (or an explicit override), never to any project's `.git`
// ancestor walk, so it cannot drift with whichever repo happened to start
// the broker.
//
// The directory NAME this module joins onto the home directory is the same
// literal repo-root.ts's toolsDir() joins onto a repo root --
// ".c64-re-tools" -- by CONVENTION, never by shared code: this module cannot
// import repo-root.ts (a host-bound module importing a container-side one is
// exactly the mistake vice-broker.mts's own parseArgs() comment warns
// against), so the literal is joined directly here, the same way
// vice-broker.mts, host-tool.mts, ghidra-project.mts, install-resources.ts
// and backend-detect.mts already do. repo-root.ts's own toolsDir() comment
// carries a census gate over this literal's every non-comment occurrence;
// this file's occurrence is accounted for there.
//
// ONE new environment knob, not two (D-13, D-14): BROKER_HOME_ENV
// ("VICE_BROKER_HOME") is simultaneously D-13's root override and D-14's
// variable that supersedes the four pre-existing broker directory
// variables. The four pre-existing variables -- VICE_POOL_DIR,
// VICE_SUPERVISOR_DIR, VICE_INCIDENTS_DIR, VICE_EPOCH_FILE -- keep working
// UNCHANGED through this phase and are honoured FIRST by the derived
// resolvers below, so nothing that reads them today breaks during the
// parallel period. Removing them is explicitly UNOWNED work: no v2.0.0
// requirement covers it (D-14), and this module does not attempt it.
//
// VICE_SUPERVISOR_DIR note: no existing production module in this tree
// actually reads `process.env.VICE_SUPERVISOR_DIR` today (verified by
// search at plan time) -- only VICE_POOL_DIR is wired to the state/
// supervisor directory in the surviving code this phase leaves untouched.
// CLAUDE.md and D-14 both name it as one of "the four" regardless, so
// brokerStateDir() below honours it as a second, lower-priority alias for
// the SAME directory VICE_POOL_DIR already wins for -- "own directory" for
// this variable means "the directory VICE_POOL_DIR also names". This is a
// new module with no consumer yet (plan 62-04 wires the broker process to
// it), so adding the alias here changes no existing runtime behaviour.
//
// WHAT NOT TO DO: never check-then-create a directory. ensureBrokerDir()
// below is a single recursive, already-exists-tolerant mkdir so two brokers
// (or two concurrent calls) racing on the same path both succeed.
import { mkdirSync } from "node:fs";
import { homedir as osHomedir, tmpdir as osTmpdir } from "node:os";
import { join, resolve } from "node:path";
/** The single new environment-variable name naming the machine-level root
 * (D-13) and superseding the four pre-existing directory variables (D-14).
 * There is one new knob, not two. */
export const BROKER_HOME_ENV = "VICE_BROKER_HOME";
/** The tools-directory name this module joins onto the user's home
 * directory by default -- the same literal repo-root.ts's toolsDir() joins
 * onto a repo root, by convention (see this file's header). */
const TOOLS_DIR_NAME = ".c64-re-tools";
function resolveEnv(opts) {
    return opts.env ?? process.env;
}
function resolveHomedir(opts) {
    return opts.homedir ?? osHomedir();
}
/** The machine-level root every broker-owned directory in this module
 * derives from. Precedence: `VICE_BROKER_HOME` when set to a non-empty
 * string, resolved to an absolute path (a relative override is absolutized
 * against the process's cwd, never left relative -- T-62-07); otherwise the
 * user's home directory joined with `.c64-re-tools`. An empty string is
 * treated as unset, not as "use the current directory". Never throws. */
export function brokerHome(opts = {}) {
    const env = resolveEnv(opts);
    const override = env[BROKER_HOME_ENV];
    if (override !== undefined && override !== "") {
        return resolve(override);
    }
    return resolve(join(resolveHomedir(opts), TOOLS_DIR_NAME));
}
/** The default (non-overridden) state/supervisor directory under the
 * machine-level root -- a private helper so brokerEpochFile()'s own default
 * can anchor to it directly, independent of whatever brokerStateDir()
 * itself resolves to when VICE_POOL_DIR/VICE_SUPERVISOR_DIR is set. This
 * keeps each of the four legacy variables' overrides independent of one
 * another: setting VICE_POOL_DIR moves brokerStateDir()'s result but does
 * NOT drag brokerEpochFile()'s default along with it. */
function defaultStateDir(opts) {
    return join(brokerHome(opts), "supervisor");
}
/** The broker's state/supervisor directory. `VICE_POOL_DIR` wins first (the
 * pre-existing, actually-wired variable), then `VICE_SUPERVISOR_DIR` (named
 * by CLAUDE.md/D-14 as one of the four pre-existing variables, though no
 * production module currently reads it -- see this file's header), else a
 * `supervisor` subdirectory of the machine-level root. */
export function brokerStateDir(opts = {}) {
    const env = resolveEnv(opts);
    const legacy = env.VICE_POOL_DIR || env.VICE_SUPERVISOR_DIR;
    if (legacy)
        return resolve(legacy);
    return defaultStateDir(opts);
}
/** The broker's incident-record directory. `VICE_INCIDENTS_DIR` wins first,
 * else an `incidents` subdirectory of the machine-level root. */
export function brokerIncidentsDir(opts = {}) {
    const env = resolveEnv(opts);
    if (env.VICE_INCIDENTS_DIR)
        return resolve(env.VICE_INCIDENTS_DIR);
    return join(brokerHome(opts), "incidents");
}
/** The broker's staging directory -- no legacy variable overrides this; it
 * is new with this module. Always a `staging` subdirectory of the
 * machine-level root. */
export function brokerStagingDir(opts = {}) {
    return join(brokerHome(opts), "staging");
}
/** The broker's per-launch config-scratch root -- no legacy variable
 * overrides this either; it is new with this module (Phase 64, XFER-07/
 * D-08). Always a `config-scratch` subdirectory of the machine-level root.
 * `broker-launch.mts`'s `spawnAndRecordInstance()` mints one fresh leaf
 * directory under THIS root per stock launch (`mkdtempSync`), for that
 * launch's isolated `XDG_CONFIG_HOME`; `broker-kill.mts`'s
 * `reapOrphanedConfigScratch()` reaps leaves left behind here whose
 * recorded process has exited.
 *
 * `broker-launch.mts` cannot import this function directly: it must stay
 * importable UNBUILT by its own test file (`broker-launch.test.ts` imports
 * this module's `.mts` source directly, never the compiled `resources/`
 * form), and a VALUE import of this sibling's compiled `.mjs` specifier
 * cannot resolve until both are compiled into `resources/` -- the same
 * constraint this file's own header names for `BrokerState`/`EpochRecord`/
 * `ViceBackend` in the opposite direction. `broker-launch.mts`'s own
 * `resolveConfigScratchRoot()` therefore DUPLICATES this exact derivation
 * (the `VICE_BROKER_HOME` env var name and the `.c64-re-tools` directory
 * name), matching this module's own header comment's established
 * convention for every other duplicated consumer of that literal
 * (`vice-broker.mts`, `host-tool.mts`, `ghidra-project.mts`,
 * `install-resources.ts`, `backend-detect.mts`). Keep the two in sync if
 * this ever changes. */
export function brokerConfigScratchDir(opts = {}) {
    return join(brokerHome(opts), "config-scratch");
}
/** The environment variable that places the Ghidra projects root. */
export const BROKER_GHIDRA_DIR_ENV = "VICE_BROKER_GHIDRA_DIR";
/** Where the broker puts each Ghidra run's project directory. Deliberately
 * NOT under brokerHome(): Ghidra refuses a project location with any
 * dot-prefixed path segment, and the default home (`~/.c64-re-tools`) has
 * one. `VICE_BROKER_GHIDRA_DIR` wins when set (absolutized); otherwise a
 * per-user directory under the OS temp directory, which carries no dotted
 * segment on Linux (`/tmp`) or macOS (`/var/folders/.../T`). A run's project
 * directory is removed when the run ends, so nothing accumulates here.
 * Whether the resolved path is acceptable to Ghidra is checked at the point
 * of use (ghidra-project.mts), never here. */
export function brokerGhidraDir(opts = {}) {
    const env = resolveEnv(opts);
    const override = env[BROKER_GHIDRA_DIR_ENV];
    if (override !== undefined && override !== "")
        return resolve(override);
    const uid = opts.uid ?? (typeof process.getuid === "function" ? process.getuid() : undefined);
    return join(opts.tmpdir ?? osTmpdir(), `c64-re-tools-ghidra-${uid ?? "user"}`);
}
/** Creates `path` recursively, tolerating it already existing -- a single
 * `mkdirSync(path, { recursive: true })` call, never a check-then-create
 * pair, so two brokers (or two concurrent calls) racing on the same path
 * both succeed rather than one erroring (T-62-09). `existsSync` is imported
 * only so a future caller can probe without creating; this function itself
 * never uses it as a guard. */
export function ensureBrokerDir(path) {
    mkdirSync(path, { recursive: true });
}
