// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from host-tool.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// host-tool.mts
//
// Phase 34, plan 34-01 (SEAM-01..SEAM-03, tracer): the host-bound executor
// for the host-tool control op. A container-side caller (host-tool-client.ts)
// reaches this module over broker-control.mts's `host_tool` op -- never
// directly -- and this module is the ONE place that turns an untrusted wire
// request into a real child process on the HOST, outside any container.
// Motivated by the project owner's own rule of 2026-08-28
// (.planning/seeds/host-tool-executor.md): a skill script runs container-side,
// the binaries it needs (acme, and later dxa/Ghidra/c1541/petcat/cartconv)
// live host-side, and there is no container PATH to find them on.
//
// THIS IS THE ONE AUTHORITATIVE PLACE for three things, none of which may be
// re-derived anywhere else:
//   - the typed per-tool allowlist (HOST_TOOL_IDS / HOST_TOOL_ARG_KEYS /
//     normaliseHostToolRequest()) -- mirrors broker-control.mts's own
//     normaliseLaunchProfile() discipline: refuse unknown keys BY NAME, never
//     coerce a type, never drop a key silently;
//   - server-side argv construction (buildHostToolArgv()) -- argv is built
//     ENTIRELY from typed, already-narrowed fields; a wire array or a wire
//     string never reaches argv (T-34-01);
//   - the async child-process invocation and its result digest (runHostTool())
//     -- spawned via node:child_process's async `spawn`, never `spawnSync`,
//     never a shell string, and bounded by a per-invocation timeout (T-34-02,
//     T-34-05).
//
// WHAT NOT TO DO, each naming the prohibition it guards (must_haves.prohibitions,
// 34-01-PLAN.md):
//   - No generic wire op that accepts a raw argv array or a raw command
//     string for a host tool -- argv is constructed server-side from typed
//     fields only (T-34-01).
//   - No shell-form child process on any host-tool path: no command
//     interpreter, no interpolated command string (T-34-02).
//   - No host-tool output written outside the bind-mounted workspace tree --
//     resolveWorkspacePath() is the only place a wire-supplied path becomes a
//     real path. BOTH the workspace root and the candidate go through the
//     same ancestor-realpath walk (realpathOfNearestExisting(), mirroring
//     anno-types.ts's storePathWithinWorkspace() and its own incident
//     history by name) before the prefix comparison, and the comparison is
//     over the WALKED (real) paths, never the lexical join -- a purely
//     lexical path.resolve() + startsWith() check is exactly what CR-05
//     (34-VERIFICATION.md gap 3) found: a symlink planted inside the
//     workspace defeated it live. This covers EVERY path-bearing wire field
//     on every tool, not only the ones present when this file was first
//     written: acme.build's source/outDir AND each entry of its includes
//     array (34-07, CR-03), and ghidra.analyze's importPath AND its
//     preScript/postScript (34-07, CR-02).
//     Two residuals recorded beside the guarantee, not hidden past it: the
//     check-then-open window between this decision and the child process's
//     own open is NOT closed here -- the child is a third-party binary
//     handed a path string, so there is no descriptor-based route to making
//     the check and the open one operation (T-34-52, accepted). And the
//     comparison is byte-wise over the resolved strings with no Unicode
//     normalisation, so two spellings differing only in normalisation form
//     are two distinct paths here (same residual anno-confinement.test.ts
//     records for the same comparison). A third note, A-16
//     (docs/phase34-host-tool-seam-decisions.md): because the return value
//     is now the REAL path, on a host whose workspace root is itself reached
//     through a symlink the response `path` need not match any member of
//     hostRootCandidates(), and containerPath() throws rather than passing
//     an untranslatable path through -- HOST_WORKSPACE_PATH naming the real
//     root is the pre-existing mitigation; this is a recorded limit, not a
//     widened hostpath.ts consumer set.
//   - No inline byte payload on a host-tool response, at any result size --
//     every result crosses as `{ path, sha256, byteLength }`, never bytes.
//   - No second copy of a tool's argv construction -- buildHostToolArgv() is
//     the one place.
//   - No synchronous child-process call on any path reachable from the
//     broker process -- runHostTool() awaits an async spawn only.
//   - No unbounded host-tool child process -- every invocation is bounded by
//     a timeout that kills the child and reports a refusal on expiry.
//
// This module must never be added to package.json's `files[]` (mirrors
// broker-control.mts's own precedent: shipped only as its compiled
// `resources/host-tool.mjs` artifact, added to build.ts's HOST_BOUND_ARTIFACTS
// and tsconfig.build.json's include[] in the same commit as this file).
//
// Phase 34, plan 34-03 (A-06, SEAM-04): this module's first SIBLING import.
// `ghidra-project.mjs` is a VALUE import (not type-only) because the rule
// must be enforced where `analyzeHeadless` is actually spawned -- inside the
// broker process -- which is why `ghidra-project.mts` ships as a compiled
// `resources/*.mjs` artifact exactly like this file does. A `.mjs`-specifier
// value import only resolves once both siblings are compiled into
// resources/ (the same reason plan 34-01's A-04 already has
// host-tool.test.ts reach THIS module as the committed artifact). The
// dot-segment rule and the per-run project location are NEVER copied here --
// this module reaches them through the one place that owns them.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGhidraProject, buildAnalyzeHeadlessArgv, hasDotPrefixedSegment, installedLanguageIds, GHIDRA_STOCK_6502_LANGUAGE_FILES, GHIDRA_IMPORT_ROUTES, importRouteBaseAddr, LANGUAGE_ID_PATTERN, LOADER_BASE_ADDR_PATTERN, RUN_ID_PATTERN, } from "./ghidra-project.mjs";
// Phase 35, plan 35-01 (A-01): this module's own directory, used ONLY to
// compute the vendored dxa binary's fixed path. Never an environment-variable
// override: dxa is vendored AND built by this project (unlike
// ACME_BIN/GHIDRA_HOME, which name a HOST PREREQUISITE a user installs
// anywhere), so an override could only ever select a binary this project did
// not build and did not pin -- precisely what DXA-01 forbids.
const HERE = dirname(fileURLToPath(import.meta.url));
export const HOST_TOOL_IDS = Object.freeze([
    "acme.build",
    "ghidra.analyze",
    "oracle.probe",
    "oracle.run",
    "dxa.disassemble",
    "ghidra.installExtension",
]);
/** Per-tool accepted argument-key lists, built with `Object.create(null)`
 * (the vsf-slice.mjs WR-04 idiom) so no prototype key can ever resolve to a
 * value here even if a future caller indexed it with an untrusted string
 * directly -- belt-and-suspenders alongside the array-membership check
 * above, which is what actually guards the lookup below.
 *
 * `ghidra.analyze`'s accepted keys carry no raw argv array and no raw
 * command string. Per field (corrected 34-07, CR-02 -- the previous wording
 * here claimed all four already flowed through a resolver, which was false
 * for the two script fields until this plan): `runId` is a bare name, never
 * a path, and flows through `resolveGhidraProject()`'s own per-run-directory
 * resolution; `importPath`, `preScript` and `postScript` each flow through
 * `resolveWorkspacePath()` -- the SAME workspace-boundary resolver
 * `acme.build`'s `source`/`outDir`/`includes` use -- before any of the four
 * ever reaches argv. `buildAnalyzeHeadlessArgv()` (ghidra-project.mts) also
 * independently re-checks `preScript`/`postScript` for a parent-directory
 * path segment, exactly as it already re-checks `projectLocation` for a
 * dot-prefixed segment -- so both rules hold even for a caller that
 * constructed these fields itself and skipped this module's own resolution
 * sites entirely.
 *
 * Phase 36, plan 36-01: `ghidra.analyze` gains `processor` (D-36-01's
 * promote decision) -- a REQUIRED, non-path, language-id string. It is
 * deliberately absent from `HOST_TOOL_PATH_ARG_KEYS` below and never flows
 * through `resolveWorkspacePath()`; it is validated against
 * `LANGUAGE_ID_PATTERN` instead (ghidra-project.mts). `ghidra.installExtension`'s
 * two keys: `sourceDir` (workspace-relative, path-bearing) and `moduleName`
 * (a non-path name validated against `RUN_ID_PATTERN`'s anchored shape,
 * exactly like `ghidra.analyze`'s own `runId`). */
export const HOST_TOOL_ARG_KEYS = Object.freeze(Object.assign(Object.create(null), {
    "acme.build": Object.freeze(["source", "outDir", "format", "setpc", "defines", "includes", "noReport"]),
    // Phase 36, plan 36-02 (GHID-01): seven new fields close the seam-argv
    // surface gap 36-RESEARCH.md measured -- importRoute (required),
    // loaderBaseAddr, noanalysis, scriptPath, entrypointsPath, exportPath,
    // expectedClassificationLines.
    "ghidra.analyze": Object.freeze([
        "runId",
        "importPath",
        "processor",
        "importRoute",
        "loaderBaseAddr",
        "noanalysis",
        "scriptPath",
        "preScript",
        "postScript",
        "entrypointsPath",
        "exportPath",
        "expectedClassificationLines",
    ]),
    // 34-08 (CR-01): EMPTY -- the oracle's location is host-side
    // configuration only (resolveOracleCommand(), below), never a wire
    // value. No caller-supplied value may ever select what the host
    // executes, even framed as merely reconfiguring an already-allowlisted
    // tool.
    "oracle.probe": Object.freeze([]),
    "oracle.run": Object.freeze(["source"]),
    // Phase 35, plan 35-01: frozen exactly as the plan's own Task 1 item 5
    // states -- five path-bearing keys plus the one enum key (`imageKind`),
    // never re-derived from ResolvedDxaDisassemblePaths below.
    "dxa.disassemble": Object.freeze(["image", "imageKind", "entrypointsPath", "datablocksPath", "labelsPath", "outDir"]),
    // Phase 36, plan 36-01 (D-36-01): `sourceDir` is the vendored extension
    // tree; `moduleName` names the install target directory under
    // <GHIDRA_HOME>/Ghidra/Extensions/.
    "ghidra.installExtension": Object.freeze(["sourceDir", "moduleName"]),
}));
/** 34-08 (Task 3): the answer to ONE question -- which accepted argument
 * keys, per tool, name a filesystem path and therefore MUST pass
 * `resolveWorkspacePath()` before ever reaching argv. Built with the SAME
 * `Object.freeze(Object.assign(Object.create(null), ...))` idiom
 * `HOST_TOOL_ARG_KEYS` above uses. Consumed by `host-tool.test.ts`'s
 * data-driven census, never by production code -- the census is what makes
 * "no argv passthrough anywhere" a mechanism rather than three point fixes:
 * a key added here without a matching resolution site is what the test
 * proves, a key ADDED to `HOST_TOOL_ARG_KEYS` without being classified HERE
 * (as path-bearing or not) is what the test's both-directions completeness
 * check catches.
 *
 * Deliberately NOT included: `ghidra.analyze`'s `runId`. It is a validated
 * opaque id bounded by its own anchored pattern (`RUN_ID_PATTERN`,
 * ghidra-project.mts), turned into a path only by `resolveGhidraProject()`
 * -- a DIFFERENT mechanism with its own guard, not `resolveWorkspacePath()`.
 * `oracle.probe`'s entry is empty because that tool accepts no arguments at
 * all (Task 1, CR-01).
 *
 * Phase 36, plan 36-01: `ghidra.analyze`'s `processor` is deliberately NOT
 * listed here -- it is a language-id string, not a path, and is validated
 * against `LANGUAGE_ID_PATTERN` instead (T-36-02). `ghidra.installExtension`'s
 * `sourceDir` IS path-bearing; `moduleName` is deliberately absent for the
 * same reason `ghidra.analyze`'s `runId` is: a validated opaque name
 * (`RUN_ID_PATTERN`) turned into a path segment only inside
 * `runHostTool()`'s own resolution branch below, never through
 * `resolveWorkspacePath()`. */
export const HOST_TOOL_PATH_ARG_KEYS = Object.freeze(Object.assign(Object.create(null), {
    "acme.build": Object.freeze(["source", "outDir", "includes"]),
    // Phase 36, plan 36-02: scriptPath/entrypointsPath/exportPath join the
    // pre-existing three -- each resolved through resolveWorkspacePath() in
    // runHostTool()'s ghidra branch, exactly like importPath/preScript/
    // postScript already are.
    "ghidra.analyze": Object.freeze(["importPath", "preScript", "postScript", "scriptPath", "entrypointsPath", "exportPath"]),
    "oracle.probe": Object.freeze([]),
    "oracle.run": Object.freeze(["source"]),
    // `imageKind` is deliberately absent -- it is a two-member enum, not a
    // path, and is the one key HOST_TOOL_ARG_KEYS_REMAINDER (host-tool.test.ts)
    // classifies for this tool.
    "dxa.disassemble": Object.freeze(["image", "entrypointsPath", "datablocksPath", "labelsPath", "outDir"]),
    "ghidra.installExtension": Object.freeze(["sourceDir"]),
}));
const HOST_TOOL_SHAPE = `an object with a "tool" field naming one of ${HOST_TOOL_IDS.map((t) => JSON.stringify(t)).join(", ")}, and an optional "args" object`;
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describe(value) {
    try {
        const json = JSON.stringify(value);
        return json === undefined ? String(value) : json;
    }
    catch {
        return String(value);
    }
}
/** THIS IS THE ONE PLACE a `host_tool` request is narrowed. Never throws;
 * answers a discriminated result naming the offending value or key AND the
 * accepted shape, exactly as broker-control.mts's normaliseLaunchProfile()
 * does. Never coerces a type (a string "true" for `noReport` is refused, not
 * converted) and never drops a key silently. */
export function normaliseHostToolRequest(raw) {
    if (!isPlainObject(raw)) {
        return { ok: false, message: `host_tool request must be ${HOST_TOOL_SHAPE}; got ${describe(raw)}` };
    }
    const toolRaw = raw.tool;
    if (typeof toolRaw !== "string" || toolRaw === "") {
        return {
            ok: false,
            message: `host_tool request "tool" field must be a non-empty string naming one of ${HOST_TOOL_IDS.join(", ")}; got ${describe(toolRaw)}`,
        };
    }
    if (!HOST_TOOL_IDS.includes(toolRaw)) {
        return { ok: false, message: `unknown host_tool "tool" value ${describe(toolRaw)}; accepted values are ${HOST_TOOL_IDS.join(", ")}` };
    }
    const tool = toolRaw;
    const argsRaw = raw.args;
    if (argsRaw !== undefined && !isPlainObject(argsRaw)) {
        return { ok: false, message: `host_tool "args" must be a plain object or absent; got ${describe(argsRaw)}` };
    }
    const argsObj = argsRaw ?? {};
    const acceptedKeys = HOST_TOOL_ARG_KEYS[tool];
    const acceptedShape = acceptedKeys.length > 0 ? `an object with optional key(s) ${acceptedKeys.join("/")}` : "an object with no accepted keys -- this tool takes no arguments";
    const unknownKeys = Object.keys(argsObj).filter((key) => !acceptedKeys.includes(key));
    if (unknownKeys.length > 0) {
        return { ok: false, message: `host_tool "${tool}" args has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${acceptedShape}` };
    }
    if (tool === "acme.build") {
        const source = argsObj.source;
        if (typeof source !== "string" || source === "") {
            return { ok: false, message: `host_tool "acme.build" requires a non-empty string "source"; got ${describe(source)}` };
        }
        const args = { source };
        if ("outDir" in argsObj) {
            const outDir = argsObj.outDir;
            if (typeof outDir !== "string" || outDir === "") {
                return { ok: false, message: `host_tool "acme.build" args.outDir must be a non-empty string; got ${describe(outDir)}` };
            }
            args.outDir = outDir;
        }
        if ("format" in argsObj) {
            const format = argsObj.format;
            if (typeof format !== "string" || format === "") {
                return { ok: false, message: `host_tool "acme.build" args.format must be a non-empty string; got ${describe(format)}` };
            }
            args.format = format;
        }
        if ("setpc" in argsObj) {
            const setpc = argsObj.setpc;
            if (typeof setpc !== "string" || setpc === "") {
                return { ok: false, message: `host_tool "acme.build" args.setpc must be a non-empty string; got ${describe(setpc)}` };
            }
            args.setpc = setpc;
        }
        if ("defines" in argsObj) {
            const defines = argsObj.defines;
            if (!Array.isArray(defines) || !defines.every((d) => typeof d === "string")) {
                return { ok: false, message: `host_tool "acme.build" args.defines must be an array of strings; got ${describe(defines)}` };
            }
            args.defines = defines;
        }
        if ("includes" in argsObj) {
            const includes = argsObj.includes;
            // Task 1 (CR-03): an empty-string entry is refused here rather than
            // silently skipped or forwarded to resolveWorkspacePath() -- the same
            // "must be an array of strings" message, tightened to reject the one
            // string value that would otherwise slip through as "an array of
            // strings" while carrying no real path.
            if (!Array.isArray(includes) || !includes.every((i) => typeof i === "string" && i !== "")) {
                return { ok: false, message: `host_tool "acme.build" args.includes must be an array of strings; got ${describe(includes)}` };
            }
            args.includes = includes;
        }
        if ("noReport" in argsObj) {
            const noReport = argsObj.noReport;
            if (typeof noReport !== "boolean") {
                return { ok: false, message: `host_tool "acme.build" args.noReport must be a boolean; got ${describe(noReport)}` };
            }
            args.noReport = noReport;
        }
        return { ok: true, request: { tool, args } };
    }
    if (tool === "ghidra.analyze") {
        const runIdRaw = argsObj.runId;
        if (typeof runIdRaw !== "string" || runIdRaw === "") {
            return { ok: false, message: `host_tool "ghidra.analyze" requires a non-empty string "runId"; got ${describe(runIdRaw)}` };
        }
        const importPathRaw = argsObj.importPath;
        if (typeof importPathRaw !== "string" || importPathRaw === "") {
            return { ok: false, message: `host_tool "ghidra.analyze" requires a non-empty string "importPath"; got ${describe(importPathRaw)}` };
        }
        // Phase 36, plan 36-01 (D-36-01, T-36-02): REQUIRED, non-defaulted --
        // the assumption-delta decision above. Refused absent, empty,
        // non-string, and non-matching, each naming the field and the accepted
        // shape; re-validated independently inside buildAnalyzeHeadlessArgv()
        // (ghidra-project.mts) so the rule holds for a caller that bypassed
        // this narrowing entirely. Byte-exact, case-sensitive comparison --
        // never case-folded (must_haves.truths, 36-01-PLAN.md).
        const processorRaw = argsObj.processor;
        if (typeof processorRaw !== "string" || processorRaw === "" || !LANGUAGE_ID_PATTERN.test(processorRaw)) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" requires a non-empty "processor" string matching ${LANGUAGE_ID_PATTERN.source} (a colon-separated Ghidra language id, alphanumeric-and-underscore segments, no path separator, no dot, length-capped); got ${describe(processorRaw)}`,
            };
        }
        // Phase 36, plan 36-02 (D-36-07): REQUIRED, non-defaulted -- exact
        // membership of a frozen two-member array, never a string passed
        // through to argv. The loader itself ("BinaryLoader") is a fixed
        // literal and never a wire field at all.
        const importRouteRaw = argsObj.importRoute;
        if (typeof importRouteRaw !== "string" || !GHIDRA_IMPORT_ROUTES.includes(importRouteRaw)) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" requires an "importRoute" matching one of ${GHIDRA_IMPORT_ROUTES.map((r) => JSON.stringify(r)).join(", ")}; got ${describe(importRouteRaw)}`,
            };
        }
        const importRoute = importRouteRaw;
        // Phase 36, plan 36-02 (D-36-07, T-36-09): loaderBaseAddr is a raw argv
        // token, never a path -- validated against the anchored
        // LOADER_BASE_ADDR_PATTERN rather than routed through
        // resolveWorkspacePath(). On the "flat64k" route the base is the
        // route's OWN; a differing supplied value is refused BY NAME rather
        // than silently honoured. On "prg" an absent value defaults to the
        // route's own base, since a .prg's load address is a property of the
        // image, not of the route.
        let loaderBaseAddr;
        if ("loaderBaseAddr" in argsObj) {
            const loaderBaseAddrRaw = argsObj.loaderBaseAddr;
            if (typeof loaderBaseAddrRaw !== "string" || !LOADER_BASE_ADDR_PATTERN.test(loaderBaseAddrRaw)) {
                return {
                    ok: false,
                    message: `host_tool "ghidra.analyze" args.loaderBaseAddr must match ${LOADER_BASE_ADDR_PATTERN.source} (a "0x" prefix followed by one to four lowercase hex digits); got ${describe(loaderBaseAddrRaw)}`,
                };
            }
            if (importRoute === "flat64k" && loaderBaseAddrRaw !== importRouteBaseAddr("flat64k")) {
                return {
                    ok: false,
                    message: `host_tool "ghidra.analyze" args.loaderBaseAddr (${loaderBaseAddrRaw}) conflicts with the "flat64k" route's own base address (${importRouteBaseAddr("flat64k")}) -- the route defines the base on this route; omit loaderBaseAddr or supply the matching value`,
                };
            }
            loaderBaseAddr = loaderBaseAddrRaw;
        }
        else {
            loaderBaseAddr = importRouteBaseAddr(importRoute);
        }
        // Phase 36, plan 36-02: a typeof boolean check, never a truthiness
        // coercion. Load-bearing rather than cosmetic: VolatileCarve.java's own
        // run() calls analyzeAll(currentProgram) itself, so omitting
        // -noanalysis would race Ghidra's own automatic post-preScript
        // analysis against the manual call.
        let noanalysis;
        if ("noanalysis" in argsObj) {
            const noanalysisRaw = argsObj.noanalysis;
            if (typeof noanalysisRaw !== "boolean") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.noanalysis must be a boolean; got ${describe(noanalysisRaw)}` };
            }
            noanalysis = noanalysisRaw;
        }
        // Phase 36, plan 36-02: a non-negative integer, refusing fractional,
        // negative, NaN and string values by name -- this field exists so
        // GHID-01's gate 1 can plant a deliberately wrong expectation.
        let expectedClassificationLines;
        if ("expectedClassificationLines" in argsObj) {
            const linesRaw = argsObj.expectedClassificationLines;
            if (typeof linesRaw !== "number" || !Number.isInteger(linesRaw) || linesRaw < 0) {
                return {
                    ok: false,
                    message: `host_tool "ghidra.analyze" args.expectedClassificationLines must be a non-negative integer; got ${describe(linesRaw)}`,
                };
            }
            expectedClassificationLines = linesRaw;
        }
        const args = { runId: runIdRaw, importPath: importPathRaw, processor: processorRaw, importRoute, loaderBaseAddr };
        if (noanalysis !== undefined)
            args.noanalysis = noanalysis;
        if (expectedClassificationLines !== undefined)
            args.expectedClassificationLines = expectedClassificationLines;
        if ("preScript" in argsObj) {
            const preScript = argsObj.preScript;
            if (typeof preScript !== "string" || preScript === "") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.preScript must be a non-empty string; got ${describe(preScript)}` };
            }
            args.preScript = preScript;
        }
        if ("postScript" in argsObj) {
            const postScript = argsObj.postScript;
            if (typeof postScript !== "string" || postScript === "") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.postScript must be a non-empty string; got ${describe(postScript)}` };
            }
            args.postScript = postScript;
        }
        // Phase 36, plan 36-02: path-bearing -- resolved through
        // resolveWorkspacePath() by runHostTool(), only validated here as a
        // non-empty string, mirroring preScript/postScript above.
        if ("scriptPath" in argsObj) {
            const scriptPath = argsObj.scriptPath;
            if (typeof scriptPath !== "string" || scriptPath === "") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.scriptPath must be a non-empty string; got ${describe(scriptPath)}` };
            }
            args.scriptPath = scriptPath;
        }
        if ("entrypointsPath" in argsObj) {
            const entrypointsPath = argsObj.entrypointsPath;
            if (typeof entrypointsPath !== "string" || entrypointsPath === "") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.entrypointsPath must be a non-empty string; got ${describe(entrypointsPath)}` };
            }
            args.entrypointsPath = entrypointsPath;
        }
        if ("exportPath" in argsObj) {
            const exportPath = argsObj.exportPath;
            if (typeof exportPath !== "string" || exportPath === "") {
                return { ok: false, message: `host_tool "ghidra.analyze" args.exportPath must be a non-empty string; got ${describe(exportPath)}` };
            }
            args.exportPath = exportPath;
        }
        // Phase 36, plan 36-02: "a script argument with no script" is refused
        // BY NAME rather than silently dropped -- a dropped argument is how a
        // run reports success having asserted nothing (must_haves.prohibitions).
        if (args.entrypointsPath !== undefined && args.preScript === undefined) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" args.entrypointsPath requires args.preScript to be present; got entrypointsPath with no preScript`,
            };
        }
        if (args.postScript === undefined && (args.exportPath !== undefined || args.expectedClassificationLines !== undefined)) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" args.exportPath/args.expectedClassificationLines require args.postScript to be present; got one of them with no postScript`,
            };
        }
        if (args.expectedClassificationLines !== undefined && args.exportPath === undefined) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" args.expectedClassificationLines requires args.exportPath to be present; got expectedClassificationLines with no exportPath`,
            };
        }
        return { ok: true, request: { tool, args } };
    }
    if (tool === "oracle.probe") {
        // 34-08 (CR-01): no key is accepted at all -- the unknown-key check
        // above already refused the retired "command" key (and any other key)
        // by name, since HOST_TOOL_ARG_KEYS["oracle.probe"] is now empty. No new
        // refusal code is needed here.
        return { ok: true, request: { tool, args: {} } };
    }
    if (tool === "oracle.run") {
        const source = argsObj.source;
        if (typeof source !== "string" || source === "") {
            return { ok: false, message: `host_tool "oracle.run" requires a non-empty string "source"; got ${describe(source)}` };
        }
        return { ok: true, request: { tool, args: { source } } };
    }
    if (tool === "dxa.disassemble") {
        const image = argsObj.image;
        if (typeof image !== "string" || image === "") {
            return { ok: false, message: `host_tool "dxa.disassemble" requires a non-empty string "image"; got ${describe(image)}` };
        }
        const imageKindRaw = argsObj.imageKind;
        // The enum is exact and case-sensitive -- "PRG" and "prg" never merge
        // (must_haves.truths, 35-01-PLAN.md).
        if (imageKindRaw !== "prg" && imageKindRaw !== "flat64k") {
            return { ok: false, message: `host_tool "dxa.disassemble" args.imageKind must be "prg" or "flat64k"; got ${describe(imageKindRaw)}` };
        }
        const args = { image, imageKind: imageKindRaw };
        if ("entrypointsPath" in argsObj) {
            const entrypointsPath = argsObj.entrypointsPath;
            if (typeof entrypointsPath !== "string" || entrypointsPath === "") {
                return { ok: false, message: `host_tool "dxa.disassemble" args.entrypointsPath must be a non-empty string; got ${describe(entrypointsPath)}` };
            }
            args.entrypointsPath = entrypointsPath;
        }
        if ("datablocksPath" in argsObj) {
            const datablocksPath = argsObj.datablocksPath;
            if (typeof datablocksPath !== "string" || datablocksPath === "") {
                return { ok: false, message: `host_tool "dxa.disassemble" args.datablocksPath must be a non-empty string; got ${describe(datablocksPath)}` };
            }
            args.datablocksPath = datablocksPath;
        }
        if ("labelsPath" in argsObj) {
            const labelsPath = argsObj.labelsPath;
            if (typeof labelsPath !== "string" || labelsPath === "") {
                return { ok: false, message: `host_tool "dxa.disassemble" args.labelsPath must be a non-empty string; got ${describe(labelsPath)}` };
            }
            args.labelsPath = labelsPath;
        }
        if ("outDir" in argsObj) {
            const outDir = argsObj.outDir;
            if (typeof outDir !== "string" || outDir === "") {
                return { ok: false, message: `host_tool "dxa.disassemble" args.outDir must be a non-empty string; got ${describe(outDir)}` };
            }
            args.outDir = outDir;
        }
        return { ok: true, request: { tool, args } };
    }
    if (tool === "ghidra.installExtension") {
        const sourceDir = argsObj.sourceDir;
        if (typeof sourceDir !== "string" || sourceDir === "") {
            return { ok: false, message: `host_tool "ghidra.installExtension" requires a non-empty string "sourceDir"; got ${describe(sourceDir)}` };
        }
        const moduleName = argsObj.moduleName;
        if (typeof moduleName !== "string" || moduleName === "" || !RUN_ID_PATTERN.test(moduleName)) {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" requires a non-empty "moduleName" string matching ${RUN_ID_PATTERN.source} (alphanumeric-first, alphanumeric/dash/underscore only, no separator, no dot, length-capped); got ${describe(moduleName)}`,
            };
        }
        return { ok: true, request: { tool, args: { sourceDir, moduleName } } };
    }
    // Unreachable while HOST_TOOL_IDS has exactly six members -- kept so a
    // future tool added to HOST_TOOL_IDS without a matching narrowing arm
    // fails loudly here rather than silently returning an under-typed request.
    return { ok: false, message: `normaliseHostToolRequest: no narrowing arm for tool "${tool}"` };
}
// ---------------------------------------------------------------------------
// Workspace-relative path resolution (A-03 / T-34-03, CR-05 / 34-10). A
// `host_tool` request never carries a host-absolute path -- every path
// argument is workspace-relative and resolved HERE, against the broker's own
// `--repo-root`, then re-checked to be inside it. This is the ONLY place a
// wire-supplied path becomes a real path.
//
// BOTH the workspace root and the candidate go through the SAME
// ancestor-realpath walk (realpathOfNearestExisting(), below) before the
// separator-appended prefix comparison, and the returned `ok: true` value is
// the WALKED (real) path, never the lexical join. That is load-bearing
// rather than a symmetry preference, for the two reasons
// anno-types.ts:1159-1176 already names for its own two consumers of this
// walk: a workspace root that does not yet exist is a legitimate input (a
// bare realpath would throw a raw ENOENT), and resolving only the candidate
// side makes every in-workspace path look foreign whenever the root itself
// is reached through a symlink. CR-05 (34-VERIFICATION.md gap 3) is what a
// purely lexical path.resolve() + startsWith() check missed: a symlink
// planted inside the workspace, pointing outside it, lexically satisfied the
// prefix check while a real write through it landed outside the root.
//
// BEHAVIOURAL CONSEQUENCE, intended: because this returns the real path, a
// link pointing INSIDE the workspace is FOLLOWED and the request is
// accepted at the link's real location -- the alternative, refusing every
// symlink, is the over-broad fix host-tool.test.ts's discriminating cases
// (34-10 Task 2) exist to redden.
//
// Two residuals recorded here, beside the guarantee rather than past it: (1)
// the check-then-open window between this decision and the child process's
// own open is not closed at this layer -- the child is a third-party binary
// handed a path string, so there is no descriptor-based route to making the
// check and the open one operation (T-34-52, accepted); (2) the comparison
// is byte-wise over the resolved strings with the platform separator
// appended and applies no Unicode normalisation, so two spellings differing
// only in normalisation form are two distinct paths here (the same residual
// anno-confinement.test.ts records for the same comparison).
//
// A-16 (docs/phase34-host-tool-seam-decisions.md): because the return value
// is now the REAL path, on a host whose workspace root is itself reached
// through a symlink the response `path` need not match any member of
// hostRootCandidates() (containerpath.ts), and containerPath() throws
// rather than passing an untranslatable path through --
// HOST_WORKSPACE_PATH naming the real root is the pre-existing mitigation.
// This is a recorded limit, not a widened hostpath.ts consumer set.
// ---------------------------------------------------------------------------
/**
 * The maximum number of DANGLING-symlink hops `realpathOfNearestExisting`
 * will take before refusing. 40 is deliberately the same value
 * anno-types.ts:971 uses -- Linux's own `MAXSYMLINKS`, so a chain this walk
 * refuses is one the kernel would refuse too. Task 2's equivalence case
 * (against anno-types.ts's storePathWithinWorkspace()) is what keeps the two
 * copies from drifting apart. The bound exists because a cycle (`a -> b`,
 * `b -> a`) is otherwise an infinite loop inside a function whose input
 * arrives unvalidated from the transport.
 */
const MAX_SYMLINK_HOPS = 40;
/**
 * Does the path ENTRY `entry` exist -- does this NAME exist in its
 * directory -- without following a symlink at the leaf, and without
 * throwing. Mirrors anno-types.ts's own `pathEntryExists`, with one
 * deliberate difference: this returns a refusal where that version throws,
 * because `resolveWorkspacePath()`'s contract is a result object and this
 * module's own never-throw discipline must not be widened by adding
 * filesystem access.
 *
 * `throwIfNoEntry: false` suppresses `ENOENT` and NOTHING ELSE
 * (anno-types.ts:985-1000's own REVERSED-2026-08-28 note) -- a permission
 * error or any other stat failure on an ancestor becomes a named refusal
 * here rather than escaping as a bare thrown error.
 */
function pathEntryExists(entry, forPath) {
    try {
        return { ok: true, exists: lstatSync(entry, { throwIfNoEntry: false }) !== undefined };
    }
    catch (e) {
        return {
            ok: false,
            message: `cannot stat ${JSON.stringify(entry)} while confining ${JSON.stringify(forPath)} (${e.message})`,
        };
    }
}
/**
 * Returns the REAL absolute path of `p`, resolved through the deepest
 * ancestor whose path ENTRY exists on disk, with the non-existent tail
 * re-joined after it -- or a refusal naming the path when the walk cannot
 * answer.
 *
 * Mirrors anno-types.ts:1082's `realpathOfNearestExisting()` exactly, with
 * the same deliberate difference `pathEntryExists()` above states: this
 * RETURNS a refusal where that version THROWS `AnnoStorePathError`. Walks up
 * while the path ENTRY does not exist, unshifting each `basename` onto a
 * `tail` array; when the walk reaches the filesystem root
 * (`dirname(current) === current`) answers from `current` plus `tail`
 * rather than from the pre-walk resolved string, because after a hop the
 * pre-walk string describes a location the walk is no longer on; when the
 * stopping entry is a symlink whose target does not exist, counts a hop,
 * refuses past `MAX_SYMLINK_HOPS` naming the bound, and resolves the link's
 * target against the LINK'S OWN DIRECTORY -- never the process cwd, since a
 * relative target (`../outside/x`) is the common form. Otherwise
 * `realpathSync(current)`, joined with `tail`. Every `lstatSync`,
 * `readlinkSync` and `realpathSync` failure becomes a refusal naming the
 * path, never a throw.
 */
function realpathOfNearestExisting(p) {
    const resolved = resolvePath(p);
    const tail = [];
    let current = resolved;
    let hops = 0;
    for (;;) {
        let reachedFilesystemRoot = false;
        for (;;) {
            const entryCheck = pathEntryExists(current, resolved);
            if (!entryCheck.ok)
                return { ok: false, message: entryCheck.message };
            if (entryCheck.exists)
                break;
            const parent = dirname(current);
            if (parent === current) {
                reachedFilesystemRoot = true;
                break;
            }
            tail.unshift(basename(current));
            current = parent;
        }
        if (reachedFilesystemRoot) {
            return { ok: true, path: tail.length === 0 ? current : join(current, ...tail) };
        }
        // The stopping ENTRY exists. Is it a symlink whose target does not?
        // That is the one class a resolve-following existence predicate cannot
        // see, and the only one needing a hop.
        let stoppedAtDanglingLink;
        try {
            stoppedAtDanglingLink = lstatSync(current).isSymbolicLink() && !existsSync(current);
        }
        catch (e) {
            return {
                ok: false,
                message: `cannot stat ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${e.message})`,
            };
        }
        if (stoppedAtDanglingLink) {
            hops += 1;
            if (hops > MAX_SYMLINK_HOPS) {
                return {
                    ok: false,
                    message: `cannot resolve ${JSON.stringify(resolved)}: more than ${MAX_SYMLINK_HOPS} symbolic-link hops while resolving ` +
                        `${JSON.stringify(current)} -- a symlink cycle or an over-long chain, refused rather than followed`,
                };
            }
            let link;
            try {
                link = readlinkSync(current);
            }
            catch (e) {
                return {
                    ok: false,
                    message: `cannot read the symbolic link ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${e.message})`,
                };
            }
            // Against the LINK'S directory, never the process cwd.
            current = resolvePath(dirname(current), link);
            continue;
        }
        let real;
        try {
            real = realpathSync(current);
        }
        catch (e) {
            return {
                ok: false,
                message: `cannot resolve the real path of ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${e.message})`,
            };
        }
        return { ok: true, path: tail.length === 0 ? real : join(real, ...tail) };
    }
}
export function resolveWorkspacePath(repoRoot, relative) {
    if (typeof relative !== "string" || relative === "") {
        return { ok: false, message: `workspace path must be a non-empty relative string; got ${describe(relative)}` };
    }
    if (isAbsolute(relative)) {
        return { ok: false, message: `workspace path must be relative to the workspace root, not absolute: ${describe(relative)}` };
    }
    const rootAbs = resolvePath(repoRoot);
    const walkedRoot = realpathOfNearestExisting(rootAbs);
    if (!walkedRoot.ok) {
        return { ok: false, message: `cannot resolve the workspace root ${JSON.stringify(rootAbs)}: ${walkedRoot.message}` };
    }
    const walkedCandidate = realpathOfNearestExisting(resolvePath(walkedRoot.path, relative));
    if (!walkedCandidate.ok) {
        return { ok: false, message: walkedCandidate.message };
    }
    if (walkedCandidate.path !== walkedRoot.path && !walkedCandidate.path.startsWith(walkedRoot.path + sep)) {
        return {
            ok: false,
            message: `workspace path escapes the workspace root: ${describe(relative)} resolves to ${walkedCandidate.path}, outside ${walkedRoot.path}`,
        };
    }
    return { ok: true, path: walkedCandidate.path };
}
/** Deterministic: the same typed request and the same resolved paths yield a
 * byte-identical argv array on two successive calls -- no randomness, no
 * timestamp, no environment-dependent ordering. */
export function buildHostToolArgv(request, resolved) {
    if (request.tool === "acme.build") {
        const { args } = request;
        const { sourcePath, outDirPath, includePaths } = resolved;
        const stem = join(outDirPath, basename(sourcePath).replace(/\.(a|asm|s)$/i, ""));
        const prg = `${stem}.prg`;
        // Overridable local variable named for what it holds -- never `binPath`/
        // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
        // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
        const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";
        // Fixed flags first, in the SAME order src/skills/acme-build/scripts/
        // acme.mjs's build() uses today, then one -D per define and one -I pair
        // per include in caller-given order, then --setpc if given, then the
        // resolved source path LAST.
        const argv = [
            "--cpu",
            "6510",
            "-f",
            args.format ?? "cbm",
            "-Wtype-mismatch",
            "--strict-segments",
            "--msvc",
            "-v1",
            "-o",
            prg,
            "-l",
            `${stem}.sym`,
            "--vicelabels",
            `${stem}.vs`,
        ];
        if (!args.noReport)
            argv.push("-r", `${stem}.rep`);
        for (const define of args.defines ?? [])
            argv.push(`-D${define}`);
        // Task 1 (CR-03): reads ONLY from resolved.includePaths -- never from
        // request.args.includes -- so argv never carries a raw wire string for
        // this field. Defensively defaults to [] so a caller that omits
        // includePaths entirely still yields a valid, empty-include argv rather
        // than throwing on an undefined iterable.
        for (const include of includePaths ?? [])
            argv.push("-I", include);
        if (args.setpc)
            argv.push("--setpc", args.setpc);
        argv.push(sourcePath);
        return { ok: true, toolPath: acmePath, argv, outputs: [prg] };
    }
    if (request.tool === "ghidra.analyze") {
        const { importPath, projectLocation, projectName, preScriptPath, postScriptPath, scriptPathResolved, entrypointsPathResolved, exportPathResolved } = resolved;
        // Named environment variable, never a guessed install location and
        // never this repository's own local probe directory (T-34-16).
        const ghidraHome = process.env.GHIDRA_HOME;
        if (ghidraHome === undefined || ghidraHome === "") {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
            };
        }
        // Overridable local variable named for what it holds -- never `binPath`/
        // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
        // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
        const ghidraPath = join(ghidraHome, "support", "analyzeHeadless");
        if (!existsSync(ghidraPath)) {
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" refuses: GHIDRA_HOME's resolved launcher does not exist on disk (${ghidraPath})`,
            };
        }
        // Phase 36, plan 36-02 (D-36-01, Task 2): the checked, NON-MATERIALISING
        // language preflight -- refuses by name, before any child process is
        // spawned, when the requested processor is not declared by any .ldefs
        // Ghidra would load, or is declared but its slafile does not exist on
        // disk. This is what makes a language that cannot load a named refusal
        // instead of a green run on whatever .sla happens to be in place
        // (OPC-04 criterion 1). The preflight CHECKS and NEVER FIXES: it must
        // never create a directory, copy a file, invoke support/sleigh, or
        // fall back to another language -- doing so would mask exactly the
        // failure criterion 1 exists to catch.
        const installedLanguages = installedLanguageIds(ghidraHome);
        const requestedProcessor = request.args.processor;
        const matchedLanguage = installedLanguages.find((lang) => lang.id === requestedProcessor);
        if (!matchedLanguage) {
            const declaredIds = installedLanguages.map((lang) => lang.id);
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" refuses: the requested processor ${JSON.stringify(requestedProcessor)} is not declared by any ` +
                    `installed Ghidra language; declared id(s): ${declaredIds.length > 0 ? declaredIds.join(", ") : "(none)"}`,
            };
        }
        if (!matchedLanguage.slafileExists) {
            const missingSlaPath = join(dirname(matchedLanguage.ldefsPath), matchedLanguage.slafile);
            return {
                ok: false,
                message: `host_tool "ghidra.analyze" refuses: processor ${JSON.stringify(requestedProcessor)} is declared by ${matchedLanguage.ldefsPath} ` +
                    `but its slafile ${missingSlaPath} does not exist on disk -- run ghidra.installExtension to build it`,
            };
        }
        // Argv construction and the dot-segment re-check both live in
        // ghidra-project.mts's buildAnalyzeHeadlessArgv() -- never re-derived
        // here (A-06).
        // Task 2 (CR-02) / 36-02: reads ONLY from resolved.preScriptPath/
        // postScriptPath/scriptPathResolved/entrypointsPathResolved/
        // exportPathResolved -- never from request.args's own path-shaped
        // fields -- so argv never carries a raw, unresolved wire string for any
        // of them.
        // Phase 36, plan 36-01/36-02: `processor`/`loaderBaseAddr`/`noanalysis`/
        // `expectedClassificationLines` come straight from request.args -- each
        // is a validated non-path value (language id, hex string, boolean,
        // integer), never a path, so none flows through resolveWorkspacePath()
        // and none appears in `resolved` (ResolvedGhidraAnalyzePaths carries
        // paths only).
        const argvInput = {
            projectLocation,
            projectName,
            importPath,
            processor: request.args.processor,
            loaderBaseAddr: request.args.loaderBaseAddr,
        };
        if (request.args.noanalysis !== undefined)
            argvInput.noanalysis = request.args.noanalysis;
        if (scriptPathResolved !== undefined)
            argvInput.scriptPath = scriptPathResolved;
        if (preScriptPath !== undefined)
            argvInput.preScript = preScriptPath;
        if (entrypointsPathResolved !== undefined)
            argvInput.entrypointsPath = entrypointsPathResolved;
        if (postScriptPath !== undefined)
            argvInput.postScript = postScriptPath;
        if (exportPathResolved !== undefined)
            argvInput.exportPath = exportPathResolved;
        if (request.args.expectedClassificationLines !== undefined)
            argvInput.expectedClassificationLines = request.args.expectedClassificationLines;
        const built = buildAnalyzeHeadlessArgv(argvInput);
        if (!built.ok)
            return { ok: false, message: built.message };
        // Phase 36, plan 36-01 (D-36-05): outputs[0] is ALWAYS the run log for
        // ghidra.analyze -- a SIBLING of the reserved project directory
        // (never a child of it), because -deleteProject operates INSIDE
        // projectLocation. runHostTool()'s ghidra.analyze branch below writes
        // the child's stdout followed by its stderr here, before the digest
        // loop runs (MEASURED: analyzeHeadless's "Using Language/Compiler:"
        // line arrives on stdout).
        const runLogPath = join(dirname(projectLocation), `${projectName}.ghidra-run.log`);
        // Phase 36, plan 36-02: when exportPath is present, it is a SECOND
        // outputs[] entry -- digested by the existing digestOutputFile() loop
        // with no new digest code. outputs[0] stays the run log unconditionally.
        const outputs = exportPathResolved !== undefined ? [runLogPath, exportPathResolved] : [runLogPath];
        return { ok: true, toolPath: ghidraPath, argv: built.argv, outputs };
    }
    if (request.tool === "dxa.disassemble") {
        const { args } = request;
        const { imagePath, outDirPath, entrypointsPath, datablocksPath, labelsPath } = resolved;
        // A-01: fixed, computed path -- never an env-var override (see the HERE
        // and findDxaBinary() comments above). Refuses BY NAME when the vendored
        // binary does not exist at EITHER candidate location, naming build.bash
        // as the remedy, per PLAN.md item 6.
        const dxaFound = findDxaBinary(HERE);
        if (dxaFound.path === null) {
            return {
                ok: false,
                message: `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist (tried: ${dxaFound.tried.join(", ")}) -- run "bash vendor/dxa/build.bash build" to produce it`,
            };
        }
        const dxaPath = dxaFound.path;
        // Fixed flags first, in a fixed order (A-02): -g 0000 ONLY for a flat
        // 64K capture, never for a .prg, whose own 2-byte load address dxa reads
        // unassisted. Then -R/-B/-l for whichever optional resolved paths are
        // present, in that order, then -a dump, then the resolved image path
        // LAST. Deterministic: the same typed request and resolved paths yield a
        // byte-identical argv array on two successive calls.
        const argv = ["-p", "all-nmos6502", "-d", "skip-scanning", "-t", "detect-internal"];
        if (args.imageKind === "flat64k")
            argv.push("-g", "0000");
        if (entrypointsPath !== undefined)
            argv.push("-R", entrypointsPath);
        if (datablocksPath !== undefined)
            argv.push("-B", datablocksPath);
        if (labelsPath !== undefined)
            argv.push("-l", labelsPath);
        argv.push("-a", "dump");
        argv.push(imagePath);
        // A-03: dxa has NO output-file option -- every listing line is
        // fprintf(stdout, ...) (vendor/dxa/dump.c). The seam captures stdout and
        // writes it to this single outputs[] path, then digests the FILE --
        // never the dxa process's own exit status, which is not the pass/fail
        // signal for a listing (must_haves.prohibitions).
        const imageStem = basename(imagePath).replace(/\.[^./]+$/, "");
        const listingPath = join(outDirPath, `${imageStem}.dxa-dump.lst`);
        return { ok: true, toolPath: dxaPath, argv, outputs: [listingPath] };
    }
    if (request.tool === "ghidra.installExtension") {
        const { moduleName } = resolved;
        // Independently re-derived rather than threaded through `resolved` --
        // mirrors ghidra.analyze's own branch above, which reads GHIDRA_HOME
        // itself instead of accepting it as a resolved field. Both existence
        // checks were already performed (and, for the copy, already acted on)
        // by runHostTool()'s own resolution branch before this function was
        // ever called; re-checking here is defense in depth, the same posture
        // buildAnalyzeHeadlessArgv()'s own independent dot-segment re-check
        // takes for a caller that bypassed the resolution branch entirely.
        const ghidraHome = process.env.GHIDRA_HOME;
        if (ghidraHome === undefined || ghidraHome === "") {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
            };
        }
        const sleighPath = join(ghidraHome, "support", "sleigh");
        if (!existsSync(sleighPath)) {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" refuses: GHIDRA_HOME's resolved "support/sleigh" does not exist on disk (${sleighPath})`,
            };
        }
        const installLanguagesDir = join(ghidraHome, "Ghidra", "Extensions", moduleName, "data", "languages");
        const slaspecPath = join(installLanguagesDir, "6502_nmos.slaspec");
        const slaPath = join(installLanguagesDir, "6502_nmos.sla");
        // Argv stays an ARRAY of individually-validated entries -- never a
        // string-concatenated single argument (must_haves.prohibitions).
        return { ok: true, toolPath: sleighPath, argv: [slaspecPath, slaPath], outputs: [slaPath] };
    }
    return { ok: false, message: `buildHostToolArgv: no argv builder for tool "${request.tool}"` };
}
// ---------------------------------------------------------------------------
// Async child-process invocation and result digest (SEAM-02, SEAM-03,
// T-34-02, T-34-05, T-34-06). NEVER `spawnSync` -- broker-kill.mts's
// uncaughtException/unhandledRejection handlers kill the ENTIRE VICE pool on
// any unhandled throw in this process, and a synchronous spawn for a
// multi-second tool run would block the single-threaded event loop for its
// whole duration, starving acquires, the warm floor, and monitor claims.
// ---------------------------------------------------------------------------
/** Fallback per-invocation timeout for a tool id absent from
 * HOST_TOOL_TIMEOUT_MS below -- unreachable today, since every HOST_TOOL_IDS
 * member has an explicit table entry, but this constant stays exported and
 * consulted as the honest bottom of the resolver's fallback chain. It is
 * also the value acme.build/oracle.probe/oracle.run's own table entries
 * hold today (20s, the same value packer-finding.mjs's own
 * ORACLE_TIMEOUT_MS convention already used) -- no longer the ceiling for
 * EVERY invocation (34-09, CR-04): a single default governing every tool is
 * exactly how CR-04 happened -- a number chosen for a stateless assembler
 * silently governed a JVM. */
export const DEFAULT_HOST_TOOL_TIMEOUT_MS = 20_000;
/** 34-09 (CR-04): the per-tool SERVER-side budget table, built with the SAME
 * `Object.freeze(Object.assign(Object.create(null), ...))` idiom
 * HOST_TOOL_ARG_KEYS uses, with an entry for EVERY HOST_TOOL_IDS member --
 * completeness enforced by host-tool.test.ts's own completeness case, never
 * assumed silently. `acme.build`, `oracle.probe` and `oracle.run` keep the
 * value DEFAULT_HOST_TOOL_TIMEOUT_MS already held (20_000ms) -- none of
 * their measured costs approach the fixed ceiling. `ghidra.analyze` gets
 * 600_000ms (10 minutes), justified from this project's own recorded
 * numbers rather than a round guess: the documented JVM startup range is
 * 12.6-17.4s (docs/phase34-host-tool-seam-decisions.md Part 1), this
 * phase's own transcript measured 12407ms and 11160ms for a *refusal* alone,
 * and the same decision record states a real analysis run takes multiple
 * minutes -- 10 minutes clears startup plus a realistic analysis budget
 * with headroom, while staying a finite, stated ceiling: raising a budget
 * must never mean removing the kill-on-expiry bound
 * (must_haves.prohibitions) -- spawnHostTool()'s timer below still kills and
 * reports a refusal on expiry, unchanged. */
export const HOST_TOOL_TIMEOUT_MS = Object.freeze(Object.assign(Object.create(null), {
    "acme.build": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    "ghidra.analyze": 600_000,
    "oracle.probe": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    "oracle.run": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    // Phase 35, plan 35-01 (A-05): DEFAULT_HOST_TOOL_TIMEOUT_MS, justified
    // from a measurement rather than a round guess -- the pinned dxa
    // disassembles a full 65,536-byte image in 21ms wall-clock (MEASURED),
    // a 950x headroom against this 20s ceiling. host-tool-client.ts's
    // request-deadline table gains NO entry for this tool, because
    // DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS (30_000) already exceeds this
    // value -- the cross-seam ordering test stays satisfied by construction.
    "dxa.disassemble": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    // Phase 36, plan 36-01: DEFAULT_HOST_TOOL_TIMEOUT_MS, justified from a
    // measurement rather than a round guess -- `support/sleigh` compiled
    // this extension's whole vendored tree in 1763ms wall-clock (MEASURED,
    // this plan's own scratch run), an ~11x headroom against this 20s
    // ceiling. host-tool-client.ts's request-deadline table gains NO entry
    // for this tool, for the same reason dxa.disassemble's own comment
    // above states: DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS (30_000) already
    // exceeds this value.
    "ghidra.installExtension": DEFAULT_HOST_TOOL_TIMEOUT_MS,
}));
/** The resolver every spawn site reads its budget from: an explicit
 * override (`deps.timeoutMs` -- the in-process test seam) always wins;
 * else the table entry above for `tool`; else DEFAULT_HOST_TOOL_TIMEOUT_MS
 * as the fallback for a tool id with no table entry (unreachable today, but
 * keeps this function total rather than partial). This is the ONE place a
 * budget is decided -- runHostTool()'s acme.build/ghidra.analyze branch,
 * runOracleProbe() and runOracleRun() all call it rather than reading
 * DEFAULT_HOST_TOOL_TIMEOUT_MS or the table directly. */
export function hostToolTimeoutMs(tool, override) {
    if (override !== undefined)
        return override;
    return HOST_TOOL_TIMEOUT_MS[tool] ?? DEFAULT_HOST_TOOL_TIMEOUT_MS;
}
/** stderrTail's byte cap -- diagnostics only, never a result. */
const STDERR_TAIL_CAP_BYTES = 64 * 1024;
/** oracle.run's stdout cap -- the SAME measured bound as
 * packer-finding.mjs's own (unmoved, still exported there) MAX_ORACLE_STDOUT_BYTES.
 * The executor enforces the bound on what it accumulates; the script keeps
 * exporting the number for its own parser and its own tests -- not a
 * duplicated maintenance burden, the same measured constant on both sides. */
const ORACLE_STDOUT_CAP_BYTES = 64 * 1024;
/** Digests one produced output file: byte size from a filesystem stat, sha256
 * over its real bytes. A zero-byte file yields `byteLength: 0` and the
 * sha256 of the empty byte string -- never an omitted or null entry. Returns
 * `null` only when the file does not exist / is unreadable, so a tool run
 * that never produced this output reports no entry for it at all (distinct
 * from a produced-but-empty file). */
function digestOutputFile(path) {
    try {
        // WR-03: byteLength must describe the SAME bytes sha256 was computed
        // over -- derived from the buffer actually read, never from a separate
        // statSync() call, which could observe a different byte string if the
        // file is written to between the two reads.
        const contents = readFileSync(path);
        const sha256 = createHash("sha256").update(contents).digest("hex");
        return { path, sha256, byteLength: contents.length };
    }
    catch {
        return null;
    }
}
/** Caps `text` to its LAST `capBytes` bytes (UTF-8), never its first --
 * diagnostics from the tail of a long run are what a caller actually needs. */
function tailBytes(text, capBytes) {
    const buf = Buffer.from(text, "utf8");
    if (buf.length <= capBytes)
        return text;
    return buf.subarray(buf.length - capBytes).toString("utf8");
}
/** Spawns `toolPath` with `argv` (an ARRAY, never a shell string; the command
 * interpreter is never enabled) and resolves -- NEVER rejects -- once the
 * child exits, errors, or is killed on timeout expiry. This is the ONE spawn
 * call in this module -- oracle.probe/oracle.run (34-04, SEAM-05) reuse it
 * rather than adding a second. `env` defaults to the broker process's own
 * environment (`spawn()`'s own default) when omitted; acme.build overrides it
 * to inject a probed `ACME` library directory (see `findAcmeLib()` below).
 * `stdout` is captured (not just `stderr`) because oracle.run's contract is
 * "the oracle's stdout", not a file digest -- acme.build/ghidra.analyze
 * simply ignore the field, exactly as they ignored stdout before it was
 * piped (ACME writes nothing to stdout; verified empirically this phase). */
function spawnHostTool(toolPath, argv, timeoutMs, env) {
    return new Promise((resolvePromise) => {
        let settled = false;
        let timedOut = false;
        let stdout = "";
        let stderr = "";
        let child;
        try {
            child = spawn(toolPath, argv, { stdio: ["ignore", "pipe", "pipe"], ...(env ? { env } : {}) });
        }
        catch (e) {
            resolvePromise({
                exitCode: null,
                timedOut: false,
                spawnErrorMessage: e instanceof Error ? e.message : String(e),
                stdout: "",
                stderr: "",
            });
            return;
        }
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, timeoutMs);
        if (typeof timer.unref === "function")
            timer.unref();
        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });
        child.on("error", (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({ exitCode: null, timedOut, spawnErrorMessage: err.message, stdout, stderr });
        });
        child.on("close", (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({ exitCode: code, timedOut, spawnErrorMessage: null, stdout, stderr });
        });
    });
}
// ---------------------------------------------------------------------------
// The ACME library probe (34-04, SEAM-05). Moved server-side from
// acme.mjs's own findAcmeLib(): the project owner's rule of 2026-08-28 is
// that a container has no PATH to a host binary, and these five candidates
// are HOST paths -- so probing them belongs on the host side of the seam,
// not in the container-side skill script. Behaviourally identical to the
// removed client-side function: same candidate order, same marker file, same
// "first candidate whose marker exists wins" rule.
// ---------------------------------------------------------------------------
/** The marker file used to validate a candidate ACME library directory --
 * the layout fact `acme.mjs`'s own troubleshooting hint names. */
const ACME_LIB_MARKER = join("cbm", "c64", "vic.a");
// ---------------------------------------------------------------------------
// The vendored dxa binary probe (Phase 35, plan 35-01, A-01). This module
// ships two ways: as unbuilt source (src/mcp/vice/host-tool.mts, HERE ==
// src/mcp/vice/) and as the compiled artifact this project actually runs
// (src/mcp/vice/resources/host-tool.mjs, HERE == src/mcp/vice/resources/).
// ghidra-project.mjs's own sibling-ness to host-tool.mjs survives that move
// because BOTH are compiled into resources/ together (build.ts's
// HOST_BOUND_ARTIFACTS). vendor/dxa/dxa does NOT survive it -- it is a real
// binary, never copied anywhere by build.ts, always at
// src/mcp/vice/vendor/dxa/dxa. So "vendor/dxa/dxa relative to import.meta.url"
// means two DIFFERENT candidate locations depending on which form of this
// module is executing: same-directory for the unbuilt source, one level up
// for the compiled artifact. Mirrors findAcmeLib()'s own "candidate list,
// first existing wins" idiom, immediately below.
// ---------------------------------------------------------------------------
function findDxaBinary(here) {
    const tried = [join(here, "vendor", "dxa", "dxa"), join(here, "..", "vendor", "dxa", "dxa")];
    for (const candidate of tried) {
        if (existsSync(candidate))
            return { path: candidate, tried };
    }
    return { path: null, tried };
}
function findAcmeLib() {
    const tried = [];
    const candidates = [
        process.env.ACME,
        "/usr/local/share/acme",
        "/usr/share/acme",
        "/usr/lib/acme",
        process.env.HOME ? join(process.env.HOME, ".acme") : undefined,
    ].filter((c) => typeof c === "string" && c !== "");
    for (const c of candidates) {
        tried.push(c);
        if (existsSync(join(c, ACME_LIB_MARKER)))
            return { path: c, tried };
    }
    return { path: null, tried };
}
/** Narrows, resolves, builds argv, then spawns the child ASYNCHRONOUSLY.
 * NOTHING throws out of this function -- every failure path (refusal, launch
 * error, timeout, non-zero exit, unreadable output) resolves to a response
 * object, because broker-kill.mts's uncaughtException/unhandledRejection
 * handlers kill the whole VICE pool on an unhandled throw in this process.
 * Emits exactly one `log()` line per ATTEMPTED invocation (i.e. once argv
 * construction succeeded and a child was actually spawned) naming the tool
 * id, the exit status, the elapsed milliseconds and (34-09, CR-04) the
 * budget that was actually applied (`timeout_ms=<n>`, from
 * hostToolTimeoutMs()) -- so which budget governed a run is observable off
 * the log line rather than inferred (A-02). A request refused before a
 * child is ever spawned emits no log line -- there is no invocation to
 * record. */
export async function runHostTool(raw, deps) {
    const narrowed = normaliseHostToolRequest(raw);
    if (!narrowed.ok)
        return { ok: false, message: narrowed.message };
    const { request } = narrowed;
    // Phase 34, plan 34-04 (SEAM-05): oracle.probe/oracle.run do not fit the
    // "spawn a tool that writes files, then digest them" shape below -- their
    // contract is the SPAWNED PROCESS'S OWN stdout (a version banner, or the
    // oracle's unpacked-output text), not a produced-file digest. Handled as
    // their own branch, reusing spawnHostTool() (the one spawn call) rather
    // than adding a second.
    if (request.tool === "oracle.probe")
        return runOracleProbe(deps);
    if (request.tool === "oracle.run")
        return runOracleRun(request.args, deps);
    const repoRootAbs = resolvePath(deps.repoRoot);
    let built;
    let acmeLib = null;
    if (request.tool === "acme.build") {
        const sourceResolved = resolveWorkspacePath(repoRootAbs, request.args.source);
        if (!sourceResolved.ok)
            return { ok: false, message: sourceResolved.message };
        let outDirPath;
        if (request.args.outDir !== undefined) {
            const outDirResolved = resolveWorkspacePath(repoRootAbs, request.args.outDir);
            if (!outDirResolved.ok)
                return { ok: false, message: outDirResolved.message };
            outDirPath = outDirResolved.path;
        }
        else {
            outDirPath = dirname(sourceResolved.path);
        }
        // Task 1 (CR-03): every `includes` entry resolved through the SAME
        // resolveWorkspacePath() site source/outDir just used. The FIRST
        // refusal returns unchanged -- the whole request fails, the offending
        // entry is never dropped and the remaining entries are never resolved
        // (no partial-success degradation, T-34-33). An absent or empty
        // `includes` yields an empty array, which buildHostToolArgv() emits as
        // no -I flags at all.
        const includePaths = [];
        for (const entry of request.args.includes ?? []) {
            const includeResolved = resolveWorkspacePath(repoRootAbs, entry);
            if (!includeResolved.ok)
                return { ok: false, message: includeResolved.message };
            includePaths.push(includeResolved.path);
        }
        built = buildHostToolArgv(request, { sourcePath: sourceResolved.path, outDirPath, includePaths });
        acmeLib = findAcmeLib();
    }
    else if (request.tool === "ghidra.analyze") {
        // Phase 35, plan 35-01: converted from the previous `if (acme.build) …
        // else (ghidra.analyze)` shape into an explicit per-tool branch -- the
        // `else`'s own comment claiming ghidra.analyze was the only remaining
        // member stopped being true the moment dxa.disassemble (below) was
        // added; leaving the implicit shape would have routed a
        // dxa.disassemble request into Ghidra's own resolver. `importPath` is
        // workspace-relative, resolved through the SAME resolveWorkspacePath()
        // site acme.build's `source` uses; the project location itself comes
        // from ghidra-project.mts's resolveGhidraProject() -- never computed
        // here (A-06).
        const importResolved = resolveWorkspacePath(repoRootAbs, request.args.importPath);
        if (!importResolved.ok)
            return { ok: false, message: importResolved.message };
        // Task 2 (CR-02): preScript/postScript resolved through the SAME
        // resolveWorkspacePath() site, BEFORE resolveGhidraProject()'s own
        // directory RESERVATION below -- a refusal here must never leave a
        // reserved-but-unused run directory behind.
        let preScriptPath;
        if (request.args.preScript !== undefined) {
            const preScriptResolved = resolveWorkspacePath(repoRootAbs, request.args.preScript);
            if (!preScriptResolved.ok)
                return { ok: false, message: preScriptResolved.message };
            preScriptPath = preScriptResolved.path;
        }
        let postScriptPath;
        if (request.args.postScript !== undefined) {
            const postScriptResolved = resolveWorkspacePath(repoRootAbs, request.args.postScript);
            if (!postScriptResolved.ok)
                return { ok: false, message: postScriptResolved.message };
            postScriptPath = postScriptResolved.path;
        }
        // Phase 36, plan 36-02 (Task 1): scriptPath/entrypointsPath/exportPath
        // resolved through the SAME resolveWorkspacePath() site, BEFORE
        // resolveGhidraProject()'s own directory RESERVATION below -- a
        // refusal here must never leave a reserved-but-unused run directory
        // behind, exactly as preScript/postScript already are.
        let scriptPathResolved;
        if (request.args.scriptPath !== undefined) {
            const scriptPathResult = resolveWorkspacePath(repoRootAbs, request.args.scriptPath);
            if (!scriptPathResult.ok)
                return { ok: false, message: scriptPathResult.message };
            scriptPathResolved = scriptPathResult.path;
        }
        let entrypointsPathResolved;
        if (request.args.entrypointsPath !== undefined) {
            const entrypointsPathResult = resolveWorkspacePath(repoRootAbs, request.args.entrypointsPath);
            if (!entrypointsPathResult.ok)
                return { ok: false, message: entrypointsPathResult.message };
            entrypointsPathResolved = entrypointsPathResult.path;
        }
        let exportPathResolved;
        if (request.args.exportPath !== undefined) {
            const exportPathResult = resolveWorkspacePath(repoRootAbs, request.args.exportPath);
            if (!exportPathResult.ok)
                return { ok: false, message: exportPathResult.message };
            exportPathResolved = exportPathResult.path;
        }
        const projectResolved = resolveGhidraProject({ repoRoot: repoRootAbs, runId: request.args.runId });
        if (!projectResolved.ok)
            return { ok: false, message: projectResolved.message };
        built = buildHostToolArgv(request, {
            importPath: importResolved.path,
            projectLocation: projectResolved.projectLocation,
            projectName: projectResolved.projectName,
            preScriptPath,
            postScriptPath,
            scriptPathResolved,
            entrypointsPathResolved,
            exportPathResolved,
        });
    }
    else if (request.tool === "dxa.disassemble") {
        // (35-01, item 7). `image` and each present optional path resolved
        // through the SAME resolveWorkspacePath() site acme.build's `source`
        // uses; `outDir` defaults to dirname(imagePath) exactly as acme.build's
        // own default does. The FIRST refusal returns unchanged -- no
        // partial-success degradation, no dropped key.
        const imageResolved = resolveWorkspacePath(repoRootAbs, request.args.image);
        if (!imageResolved.ok)
            return { ok: false, message: imageResolved.message };
        let outDirPath;
        if (request.args.outDir !== undefined) {
            const outDirResolved = resolveWorkspacePath(repoRootAbs, request.args.outDir);
            if (!outDirResolved.ok)
                return { ok: false, message: outDirResolved.message };
            outDirPath = outDirResolved.path;
        }
        else {
            outDirPath = dirname(imageResolved.path);
        }
        let entrypointsPath;
        if (request.args.entrypointsPath !== undefined) {
            const entrypointsResolved = resolveWorkspacePath(repoRootAbs, request.args.entrypointsPath);
            if (!entrypointsResolved.ok)
                return { ok: false, message: entrypointsResolved.message };
            entrypointsPath = entrypointsResolved.path;
        }
        let datablocksPath;
        if (request.args.datablocksPath !== undefined) {
            const datablocksResolved = resolveWorkspacePath(repoRootAbs, request.args.datablocksPath);
            if (!datablocksResolved.ok)
                return { ok: false, message: datablocksResolved.message };
            datablocksPath = datablocksResolved.path;
        }
        let labelsPath;
        if (request.args.labelsPath !== undefined) {
            const labelsResolved = resolveWorkspacePath(repoRootAbs, request.args.labelsPath);
            if (!labelsResolved.ok)
                return { ok: false, message: labelsResolved.message };
            labelsPath = labelsResolved.path;
        }
        built = buildHostToolArgv(request, {
            imagePath: imageResolved.path,
            outDirPath,
            entrypointsPath,
            datablocksPath,
            labelsPath,
        });
    }
    else {
        // request.tool === "ghidra.installExtension" (36-01, D-36-01). `sourceDir`
        // resolved through the SAME resolveWorkspacePath() site every other
        // tool's path argument uses. The materialisation side effects (create
        // the install directory, copy the vendored tree, copy the three stock
        // 6502 language files) happen HERE, in the resolution branch -- mirroring
        // resolveGhidraProject()'s own "reservation" side effect above -- so
        // buildHostToolArgv() stays the one place argv/outputs are DERIVED from
        // already-materialised, typed fields (never the place a filesystem
        // mutation happens).
        const sourceDirResolved = resolveWorkspacePath(repoRootAbs, request.args.sourceDir);
        if (!sourceDirResolved.ok)
            return { ok: false, message: sourceDirResolved.message };
        const ghidraHome = process.env.GHIDRA_HOME;
        if (ghidraHome === undefined || ghidraHome === "") {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
            };
        }
        const sleighPath = join(ghidraHome, "support", "sleigh");
        if (!existsSync(sleighPath)) {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" refuses: GHIDRA_HOME's resolved "support/sleigh" does not exist on disk (${sleighPath})`,
            };
        }
        const stockLanguagesDir = join(ghidraHome, "Ghidra", "Processors", "6502", "data", "languages");
        const missingStockFiles = GHIDRA_STOCK_6502_LANGUAGE_FILES.filter((name) => !existsSync(join(stockLanguagesDir, name)));
        if (missingStockFiles.length > 0) {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" refuses: the stock 6502 language file(s) ${missingStockFiles.join(", ")} do not exist at ${stockLanguagesDir} -- this Ghidra installation is missing its own 6502 processor module`,
            };
        }
        const installDir = join(ghidraHome, "Ghidra", "Extensions", request.args.moduleName);
        const installLanguagesDir = join(installDir, "data", "languages");
        try {
            mkdirSync(installLanguagesDir, { recursive: true });
            cpSync(sourceDirResolved.path, installDir, { recursive: true });
            for (const name of GHIDRA_STOCK_6502_LANGUAGE_FILES) {
                cpSync(join(stockLanguagesDir, name), join(installLanguagesDir, name));
            }
        }
        catch (e) {
            return {
                ok: false,
                message: `host_tool "ghidra.installExtension" failed to materialise the extension at ${installDir}: ${e instanceof Error ? e.message : String(e)}`,
            };
        }
        built = buildHostToolArgv(request, { sourceDirPath: sourceDirResolved.path, moduleName: request.args.moduleName });
    }
    if (!built.ok)
        return { ok: false, message: built.message };
    const timeoutMs = hostToolTimeoutMs(request.tool, deps.timeoutMs);
    const startedAt = Date.now();
    // acme.build only: inject the probed ACME library directory as the child's
    // `ACME` env var, exactly as acme.mjs's own removed findAcmeLib() call
    // used to (T-34's own "same behaviour, moved" requirement) -- undefined
    // when no candidate matched, which spawnHostTool() treats identically to
    // "no override" (inherits the broker's own environment unchanged).
    const spawnEnv = acmeLib?.path ? { ...process.env, ACME: acmeLib.path } : undefined;
    const spawnResult = await spawnHostTool(built.toolPath, built.argv, timeoutMs, spawnEnv);
    const elapsedMs = Date.now() - startedAt;
    if (spawnResult.spawnErrorMessage !== null) {
        deps.log?.(`host_tool tool=${request.tool} exit=spawn_error elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);
        return { ok: false, message: `runHostTool: failed to launch "${built.toolPath}": ${spawnResult.spawnErrorMessage}` };
    }
    if (spawnResult.timedOut) {
        deps.log?.(`host_tool tool=${request.tool} exit=timeout elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);
        return { ok: false, message: `runHostTool: "${request.tool}" timed out after ${timeoutMs}ms and was killed` };
    }
    deps.log?.(`host_tool tool=${request.tool} exit=${spawnResult.exitCode ?? "null"} elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);
    // dxa.disassemble only (A-03): dxa has NO output-file option -- every
    // listing line is fprintf(stdout, ...) (vendor/dxa/dump.c). Every other
    // tool's outputs[] entries are already real files the child process wrote
    // itself; this is the one tool whose "output" IS the captured stdout, so
    // this is the one place that stdout is turned into a file before the
    // digest loop below ever runs. No second spawn call is added.
    if (request.tool === "dxa.disassemble" && built.outputs.length > 0) {
        try {
            writeFileSync(built.outputs[0], spawnResult.stdout, "utf8");
        }
        catch {
            // Falls through to the digest loop below, whose digestOutputFile()
            // returns null for a file that does not exist -- an empty results[]
            // rather than a thrown error, consistent with this module's
            // never-throw discipline.
        }
    }
    // Phase 36, plan 36-01 (D-36-05): ghidra.analyze's outputs[0] is ALWAYS
    // the run log. `HostToolClientResult` carries no stdout field at all, so
    // this is the ONE place the run log becomes reachable from the container
    // side. MEASURED against real Ghidra 12.1.3: analyzeHeadless's own
    // "Using Language/Compiler:" line arrives on STDOUT; stderr is appended
    // after it so no line can be lost.
    if (request.tool === "ghidra.analyze" && built.outputs.length > 0) {
        try {
            writeFileSync(built.outputs[0], `${spawnResult.stdout}${spawnResult.stderr}`, "utf8");
        }
        catch {
            // Falls through to the digest loop below, whose digestOutputFile()
            // returns null for a file that does not exist -- an empty results[]
            // rather than a thrown error, consistent with this module's
            // never-throw discipline.
        }
    }
    const results = [];
    for (const outputPath of built.outputs) {
        const digested = digestOutputFile(outputPath);
        if (digested)
            results.push(digested);
    }
    // acme.build only: ACME's own "for <...> includes..." complaint names no
    // directory it tried -- append a note line (in the plain, non-MSVC shape
    // acme.mjs's own parseDiagnostics() already treats as a "note" entry)
    // naming every candidate this probe tried, exactly as the removed
    // client-side hint used to. A line appended here, rather than reported as
    // a separate field, keeps acme.mjs's diagnostics parsing untouched -- it
    // already scans the combined text for exactly this shape.
    let stderrText = spawnResult.stderr;
    if (acmeLib && /ACME.*environment variable/i.test(stderrText)) {
        stderrText += `\nfor <...> includes, set $ACME to the directory holding ${ACME_LIB_MARKER} (looked in: ${acmeLib.tried.join(", ")})`;
    }
    return {
        ok: true,
        tool: request.tool,
        exitStatus: spawnResult.exitCode,
        results,
        stderrTail: tailBytes(stderrText, STDERR_TAIL_CAP_BYTES),
    };
}
// ---------------------------------------------------------------------------
// oracle.probe / oracle.run (34-04, SEAM-05). Migrated from
// packer-finding.mjs's own probeUnp64()/runUnp64(): everything about the
// BINARY (locating it, the version-banner probe, the scratch output
// location, the argument array, the runtime bound) lives here now; the
// script keeps everything about the FINDING (the name parser, the accepted
// character set, the caps, the packedness threshold, the never-throw return
// shapes). Response shapes are NOT the generic `{ ok, tool, exitStatus,
// results, stderrTail }` envelope above -- they mirror packer-finding.mjs's
// OWN pre-existing `{ available, command, version, reason }` /
// `{ ok, stdout, reason }` contracts directly, so the migrated client-side
// functions can return the seam's response with no field renaming.
// ---------------------------------------------------------------------------
/** Default command name when no host-side configuration is present -- the
 * same default packer-finding.mjs's own (removed) DEFAULT_ORACLE_COMMAND
 * used. */
const DEFAULT_ORACLE_COMMAND = "unp64";
/** The two environment variables the oracle's location is read from, in this
 * order -- the SAME variable order and names packer-finding.mjs's own
 * (client-side, container-facing) `ORACLE_ENV_VARS` declares, so a
 * container-side hint naming one of these two variables always describes
 * where this host-side resolver actually looked. */
const ORACLE_ENV_VARS = Object.freeze(["UNP64", "UNP64_PATH"]);
/** 34-08 (CR-01): THE ONE PLACE the oracle binary's location is decided,
 * consulted by BOTH `runOracleProbe()` and `runOracleRun()` -- mirrors
 * `findAcmeLib()` above, which `34-04` already moved host-side for exactly
 * this reason: the container has no PATH to a host binary, so probing host
 * locations belongs on the host side of the seam. Reads the BROKER
 * PROCESS'S OWN environment -- never a wire value, because
 * `HOST_TOOL_ARG_KEYS["oracle.probe"]` accepts no keys at all. When a
 * variable is set, two checks apply in order: the configured path's base
 * name must equal `DEFAULT_ORACLE_COMMAND` (the review's own suggested
 * check, kept as a second layer over the wire-key removal), and the path
 * must exist on disk. Each refusal reason names WHICH variable was set and
 * NEVER interpolates the configured value (T-19-18, carried forward from
 * `34-04`). With no variable set, answers the bare `DEFAULT_ORACLE_COMMAND`
 * -- the existing search-path behaviour, unchanged. */
function resolveOracleCommand() {
    for (const varName of ORACLE_ENV_VARS) {
        const raw = process.env[varName];
        if (typeof raw !== "string" || raw.trim() === "")
            continue;
        const configured = raw.trim();
        if (basename(configured) !== DEFAULT_ORACLE_COMMAND) {
            return {
                ok: false,
                reason: `the oracle configured via ${varName} is not named "${DEFAULT_ORACLE_COMMAND}" -- treated as oracle-absent`,
            };
        }
        if (!existsSync(configured)) {
            return {
                ok: false,
                reason: `the oracle configured via ${varName} does not exist on disk -- treated as oracle-absent`,
            };
        }
        return { ok: true, command: configured };
    }
    return { ok: true, command: DEFAULT_ORACLE_COMMAND };
}
async function runOracleProbe(deps) {
    const resolved = resolveOracleCommand();
    if (!resolved.ok) {
        // No child is spawned on this branch -- WITHOUT echoing the configured
        // value anywhere (T-19-18); resolved.reason already names the variable,
        // never the value.
        deps.log?.(`host_tool tool=oracle.probe exit=absent_configured_path`);
        return { ok: true, tool: "oracle.probe", available: false, command: null, version: null, reason: resolved.reason };
    }
    const command = resolved.command;
    const timeoutMs = hostToolTimeoutMs("oracle.probe", deps.timeoutMs);
    const spawnResult = await spawnHostTool(command, ["--version"], timeoutMs);
    if (spawnResult.spawnErrorMessage !== null) {
        deps.log?.(`host_tool tool=oracle.probe exit=spawn_error timeout_ms=${timeoutMs}`);
        return {
            ok: true,
            tool: "oracle.probe",
            available: false,
            command: null,
            version: null,
            reason: `no "${DEFAULT_ORACLE_COMMAND}" packer identifier could be launched`,
        };
    }
    if (spawnResult.timedOut) {
        deps.log?.(`host_tool tool=oracle.probe exit=timeout timeout_ms=${timeoutMs}`);
        return {
            ok: true,
            tool: "oracle.probe",
            available: false,
            command: null,
            version: null,
            reason: "the packer identifier timed out during the version probe",
        };
    }
    deps.log?.(`host_tool tool=oracle.probe exit=${spawnResult.exitCode ?? "null"} timeout_ms=${timeoutMs}`);
    const banner = `${spawnResult.stdout}${spawnResult.stderr}`.trim();
    if (banner === "") {
        return {
            ok: true,
            tool: "oracle.probe",
            available: false,
            command: null,
            version: null,
            reason: "the packer identifier produced no version banner, so it was not accepted as an oracle",
        };
    }
    return { ok: true, tool: "oracle.probe", available: true, command, version: banner.slice(0, 200), reason: null };
}
async function runOracleRun(args, deps) {
    const repoRootAbs = resolvePath(deps.repoRoot);
    const sourceResolved = resolveWorkspacePath(repoRootAbs, args.source);
    if (!sourceResolved.ok) {
        return { ok: false, tool: "oracle.run", stdout: "", reason: sourceResolved.message };
    }
    if (!existsSync(sourceResolved.path)) {
        return { ok: false, tool: "oracle.run", stdout: "", reason: "the input file does not exist" };
    }
    // 34-08 (CR-01): the SAME resolver oracle.probe consults -- never a bare
    // DEFAULT_ORACLE_COMMAND argument at the spawn site below. Before this
    // change a host-side configured oracle was honoured by the probe and
    // silently ignored by the run, so a working probe could be followed by a
    // failing run; resolving here closes that gap as a real defect fix, not
    // merely a mechanical follow-on from Task 1's wire-key removal.
    const resolvedCommand = resolveOracleCommand();
    if (!resolvedCommand.ok) {
        deps.log?.(`host_tool tool=oracle.run exit=absent_configured_path`);
        return { ok: false, tool: "oracle.run", stdout: "", reason: resolvedCommand.reason };
    }
    // The oracle's unpacked output goes to a scratch location INSIDE the
    // workspace tree -- never the system temp directory, which cannot be
    // translated back across the container boundary -- removed after this
    // function returns, mirroring packer-finding.mjs's own (removed)
    // "removed before this function returns" property (T-19-24).
    const scratchDir = join(repoRootAbs, "tools", "oracle-runs", `run-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(scratchDir, { recursive: true });
    const scratchOut = join(scratchDir, "unpacked.out");
    try {
        const timeoutMs = hostToolTimeoutMs("oracle.run", deps.timeoutMs);
        const spawnResult = await spawnHostTool(resolvedCommand.command, [sourceResolved.path, scratchOut], timeoutMs);
        if (spawnResult.spawnErrorMessage !== null) {
            deps.log?.(`host_tool tool=oracle.run exit=spawn_error timeout_ms=${timeoutMs}`);
            return { ok: false, tool: "oracle.run", stdout: "", reason: "the oracle could not be run against the input file" };
        }
        if (spawnResult.timedOut) {
            deps.log?.(`host_tool tool=oracle.run exit=timeout timeout_ms=${timeoutMs}`);
            return { ok: false, tool: "oracle.run", stdout: "", reason: "the oracle timed out" };
        }
        deps.log?.(`host_tool tool=oracle.run exit=${spawnResult.exitCode ?? "null"} timeout_ms=${timeoutMs}`);
        // Capped the same way packer-finding.mjs's own MAX_ORACLE_STDOUT_BYTES
        // caps it client-side -- the executor enforces the bound on what it
        // accumulates; the script still exports the number for its own parser
        // and its own tests, so the value is not duplicated as a maintained pair,
        // only as the same measured constant on both sides of the seam.
        const stdout = spawnResult.stdout.length > ORACLE_STDOUT_CAP_BYTES ? spawnResult.stdout.slice(0, ORACLE_STDOUT_CAP_BYTES) : spawnResult.stdout;
        return { ok: true, tool: "oracle.run", stdout, reason: null };
    }
    finally {
        try {
            rmSync(scratchDir, { recursive: true, force: true });
        }
        catch {
            // Best effort -- a leftover empty scratch directory is not worth
            // failing a read-only recon finding over (mirrors packer-finding.mjs's
            // own removed comment to the same effect).
        }
    }
}
// ---------------------------------------------------------------------------
// CLI entry point (guarded on being the process entry point, the
// check-npm-packages.mjs:159 IS_ENTRY_POINT idiom). Plan 34-04 needs this for
// the host-local route (no broker in the loop); wired now so this tracer
// proves it. `node resources/host-tool.mjs run --repo-root <path> --request
// <json>` prints the response as one JSON line on stdout and exits non-zero
// on a refusal.
// ---------------------------------------------------------------------------
function parseCliArgs(argv) {
    let repoRoot;
    let request;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--repo-root") {
            repoRoot = argv[i + 1];
            i++;
        }
        else if (argv[i] === "--request") {
            request = argv[i + 1];
            i++;
        }
    }
    return { repoRoot, request };
}
const IS_ENTRY_POINT = process.argv[1] !== undefined && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY_POINT) {
    const [, , cliCommand, ...cliRest] = process.argv;
    if (cliCommand !== "run") {
        process.stderr.write("usage: host-tool.mjs run --repo-root <path> --request <json>\n");
        process.exitCode = 1;
    }
    else {
        const { repoRoot, request } = parseCliArgs(cliRest);
        if (!repoRoot || !request) {
            process.stderr.write("usage: host-tool.mjs run --repo-root <path> --request <json>\n");
            process.exitCode = 1;
        }
        else {
            let raw;
            try {
                raw = JSON.parse(request);
            }
            catch {
                raw = null;
            }
            runHostTool(raw, { repoRoot }).then((response) => {
                process.stdout.write(`${JSON.stringify(response)}\n`);
                process.exitCode = response.ok ? 0 : 1;
            });
        }
    }
}
