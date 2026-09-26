#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from src/mcp/vice/vice-cli.mts. Edit the TypeScript source and run
// `node build.ts` in src/mcp/vice; entry-sync.test.ts reds on drift.
// vice-cli.mts
//
// WHY THIS FILE EXISTS: the package's single bin and `main`. It refuses a
// below-floor Node by name BEFORE anything type-stripped is imported, then
// dispatches: `broker` to the compiled resources/vice-broker.mjs (with the
// subcommand token removed), everything else (`anno`, no subcommand) to
// vice-proxy.ts with argv unchanged. build.ts compiles it to vice-cli.mjs
// beside this file, because a bin runs from node_modules, where Node never
// strips types, and because a below-floor Node cannot parse TypeScript at all.
//
// WHAT NOT TO DO:
//   - Never import anything but node: builtins before the floor check.
//   - Never write a dispatch target as a literal import() specifier: tsc would
//     pull the broker or proxy graph into this file's standalone compile.
//   - Never list this file as host-bound: it is an entry artifact, and
//     install-resources must never deploy it.
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
const PACKAGE_JSON_PATH = new URL("./package.json", import.meta.url);
const DEFAULT_PACKAGE_NAME = "@henols/vice-mcp";
// Dispatch targets: variables, never literal import() specifiers (see header).
const BROKER_ARTIFACT = "./resources/vice-broker.mjs";
const PROXY_ENTRY = "./vice-proxy.ts";
/** The bash launcher's own floor-refusal exit code
 * (`resources/vice-launcher.sh`'s "interpreter gate" section) -- mirrored
 * here, never re-derived, so the two refusals are indistinguishable to
 * anything watching exit codes. */
export const FLOOR_REFUSAL_EXIT_CODE = 4;
/** Test-only escape hatch, never documented to end users and inert unless
 * this exact env var is set: lets a test drive the below-floor refusal path
 * without installing a second, genuinely below-floor Node interpreter. This
 * file already runs under the interpreter it is checking, so injecting a
 * simulated major is the only way to exercise that path at all. Never
 * reachable from a real invocation -- the check is against a specific,
 * unambiguous env var name no real caller would ever set. Mirrors
 * vice-proxy.ts's own VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES hatch. */
const SIMULATED_NODE_MAJOR_ENV = "VICE_CLI_TEST_SIMULATED_NODE_MAJOR";
/** Extracts the first integer found in `str`, or `null` when `str` is not a
 * string or contains no digits. Shared arithmetic for both a semver RANGE
 * (`">=24.0.0"`) and a plain version string (`"24.13.3"`), since both need
 * only their leading major number. */
function firstIntegerIn(str) {
    if (typeof str !== "string")
        return null;
    const match = /(\d+)/.exec(str);
    return match ? Number(match[1]) : null;
}
/** Extracts the major version number from a semver RANGE string such as
 * `">=24.0.0"` -- the exact shape `package.json`'s `engines.node` field
 * uses in this package. Returns `null` for anything that carries no
 * parseable integer, rather than throwing: a malformed manifest degrades to
 * "refuse by name", never to "assume a floor". Exported so a test can drive
 * the arithmetic directly without spawning a real process. */
export function floorMajorFromEngineRange(range) {
    return firstIntegerIn(range);
}
/** Reads `manifestPath` (a `file://` URL or a plain path) and derives the
 * required floor major version from its `engines.node` field. Returns
 * `null` -- never throws -- when the file is missing, unparsable, or
 * carries no derivable floor; the caller degrades to refusing by name
 * rather than assuming a floor. Exported so a test can point this at a
 * fixture manifest and assert the derived floor changes with it, without
 * ever touching this package's own real manifest. */
export function resolveFloorMajor(manifestPath) {
    let raw;
    try {
        raw = readFileSync(manifestPath, "utf8");
    }
    catch {
        return null;
    }
    let pkg;
    try {
        pkg = JSON.parse(raw);
    }
    catch {
        return null;
    }
    const range = pkg && pkg.engines ? pkg.engines.node : undefined;
    return floorMajorFromEngineRange(range);
}
/** Pure comparison: is `runningMajor` at or above `floorMajor`? Exported so
 * the version arithmetic itself is unit-testable directly, without
 * spawning a real node interpreter at every possible version to prove it. */
export function meetsFloor(runningMajor, floorMajor) {
    return (typeof runningMajor === "number" &&
        typeof floorMajor === "number" &&
        Number.isFinite(runningMajor) &&
        Number.isFinite(floorMajor) &&
        runningMajor >= floorMajor);
}
/** Removes the `broker` subcommand token from a `process.argv`-shaped array
 * (`[execPath, thisFile, "broker", ...rest]`), returning exactly what the
 * broker artifact's own `main(argv)` must see -- the same argument vector
 * it saw before this file existed. A silent argument rewrite is otherwise a
 * trap for the next reader, which is why this is its own named, exported,
 * pure function rather than an inline `.slice(3)` at the call site. */
export function brokerArgvFrom(argv) {
    return argv.slice(3);
}
/** Resolves the major version this process is actually running under,
 * honouring the test-only simulated-major escape hatch above when set.
 * Returns `null` if the simulated value cannot be parsed as a number, or if
 * `process.versions.node` (which should never happen) carries no digits. */
function resolveRunningMajor() {
    const simulated = process.env[SIMULATED_NODE_MAJOR_ENV];
    if (simulated !== undefined) {
        const parsed = Number(simulated);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return firstIntegerIn(process.versions.node);
}
async function main() {
    let pkg = null;
    try {
        pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
    }
    catch {
        pkg = null;
    }
    const packageName = pkg && typeof pkg.name === "string" ? pkg.name : DEFAULT_PACKAGE_NAME;
    // Reuses resolveFloorMajor() -- the SAME derivation a test can point at a
    // fixture manifest and verify independently -- rather than re-deriving the
    // floor inline here from the `pkg` object already read above for the name.
    const floorMajor = resolveFloorMajor(PACKAGE_JSON_PATH);
    if (floorMajor === null) {
        process.stderr.write(`${packageName}: refusing to start -- could not determine the required Node engine floor from ` +
            `${fileURLToPath(PACKAGE_JSON_PATH)} (missing or malformed manifest). Reinstall the package, ` +
            `or file a bug report if the manifest looks intact.\n`);
        process.exit(FLOOR_REFUSAL_EXIT_CODE);
    }
    const runningMajor = resolveRunningMajor();
    if (!meetsFloor(runningMajor, floorMajor)) {
        const simulated = process.env[SIMULATED_NODE_MAJOR_ENV];
        process.stderr.write(`${packageName}: refusing to start -- running under Node ${process.versions.node}` +
            (simulated !== undefined ? ` (simulated major ${runningMajor} for testing)` : "") +
            `, which is below the required floor v${floorMajor}.x. Install a Node >= v${floorMajor} and put it ` +
            `on PATH, or set VICE_BROKER_NODE to an absolute path to one that satisfies the floor.\n`);
        process.exit(FLOOR_REFUSAL_EXIT_CODE);
    }
    const subcommand = process.argv[2];
    if (subcommand === "broker") {
        // The broker artifact's own main(argv) is called HERE, explicitly, with
        // the subcommand token already removed -- its own parseArgs() never
        // sees "broker" as a stray positional token (which it would otherwise
        // treat as a malformed invocation and refuse).
        const brokerArgv = brokerArgvFrom(process.argv);
        const { main: brokerMain } = await import(BROKER_ARTIFACT);
        brokerMain(brokerArgv);
        return;
    }
    // Everything else -- the `anno` subcommand and no subcommand at all --
    // delegates to the existing proxy entry with the argument vector
    // UNTOUCHED, preserving its own dispatch (including its "unknown
    // subcommand" fallthrough) exactly as it behaves today. A side effect of
    // routing through here at all: the annotation route now gets the same
    // floor protection above it never had before this file existed.
    await import(PROXY_ENTRY);
}
// -------------------------------------------------------------------- CLI
//
// Only runs main() when THIS file is the actual process entry point --
// never on a plain `import` (e.g. a test importing the pure functions
// above), which would otherwise re-run the floor check and the dispatch
// against the IMPORTER's own argv as an unwanted side effect of loading the
// module. Mirrors vice-broker.mts's own bottom-of-file CLI guard exactly.
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        process.stderr.write(`vice-cli: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exitCode = 1;
    });
}
