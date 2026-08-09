// build.ts
//
// Compiles the host-bound TypeScript sources (today: vice-broker.mts only --
// see tsconfig.build.json's `include`, which IS the definition of host-bound)
// into banner-marked, committed JavaScript under resources/. Run directly as
// `node build.ts` (native type stripping, no tsc needed to run THIS file --
// only to run the compiler it shells out to).
//
// This file itself must stay inside erasableSyntaxOnly's restrictions (no
// enum/namespace/constructor parameter properties) so it can run unflagged
// under bare `node`, exactly like vice-broker.mts.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Resolves an `outDir` option (or the CLI's `--out-dir` flag) to an absolute
 * path: an absolute input is used as-is, a relative one is joined against
 * this module's own directory. Shared by build() and the CLI success
 * message below so the two never drift apart. */
function resolveOutDirAbs(outDir: string): string {
  return resolvePath(outDir).startsWith("/") && outDir.startsWith("/") ? outDir : join(HERE, outDir);
}

/** The literal expected emitted relative paths -- today exactly the one
 * broker artifact. This list IS the host-bound artifact set: build() asserts
 * the emitted file set equals this exactly, so an unexpected addition or a
 * silent omission both fail loudly rather than deploying something nobody
 * reviewed. */
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
];

/** The generated-file banner (01.6-RESEARCH.md §F), a function of the
 * source's relative path. Prepended to every emitted file by build() below --
 * this is the ONLY place that produces this text, so a sync test built
 * against the same build() entry point can never observe a second,
 * independently-drifted banner implementation. */
export function GENERATED_BANNER(relSourcePath: string): string {
  return (
    "// GENERATED FILE -- DO NOT EDIT.\n" +
    `// Compiled by \`tsc\` from ${relSourcePath}. Edit the TypeScript source and rebuild;\n` +
    "// changes made directly to this file are silently overwritten by the next build, and are never\n" +
    "// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents\n" +
    "// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next\n" +
    "// rebuild.\n"
  );
}

/** Recursive walk of `dir`, returning every `.mjs` file's relative (posix,
 * "/"-joined) path underneath it. Mirrors install-resources.mjs's own walk()
 * shape -- a real directory listing, not a hardcoded list. */
function emittedMjsFilesUnder(dir: string, base = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${dirent.name}` : dirent.name;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...emittedMjsFilesUnder(abs, rel));
    } else if (dirent.isFile() && dirent.name.endsWith(".mjs")) {
      out.push(rel);
    }
  }
  return out.sort();
}

/** Maps an emitted `.mjs` relative path back to the `.mts` source path the
 * banner should name -- the only mapping this build knows (rootDir "." means
 * emitted layout mirrors source layout 1:1, with the .mts->.mjs extension
 * swap tsc performs automatically for module: nodenext). */
function sourceRelForEmitted(emittedRel: string): string {
  return emittedRel.replace(/\.mjs$/, ".mts");
}

export interface BuildOptions {
  outDir?: string;
}

/**
 * Runs the pinned compiler against tsconfig.build.json into a private,
 * same-filesystem staging directory, asserts the emitted file set is
 * EXACTLY HOST_BOUND_ARTIFACTS (catches both a missing artifact and an
 * unexpected one), prepends the generated-file banner to each artifact
 * WHILE STILL STAGED, then atomically `rename()`s each finished artifact
 * into `outDir` (default "resources", relative to this module's own
 * directory or an absolute path).
 *
 * Nothing lands at a path inside `outDir` until that path's final bytes
 * (compiled output plus banner) already exist complete elsewhere, so a
 * reader of `outDir` -- including a sibling `build()` call's own
 * resources-sync-style comparison, or a process that spawns an artifact
 * straight out of `outDir` -- can never observe a partial or banner-less
 * file. This is per-file atomic replacement, not a lock: no caller in this
 * repo mutates the .mts sources between builds, so every concurrent build
 * emits byte-identical output and there is no "which generation wins"
 * question to answer, only "never expose a half-written file", which
 * `rename()` onto a fully-finished path already guarantees.
 *
 * The staging directory is a SIBLING of `outDir` (never inside it -- a
 * directory walk over `outDir`, such as resources-sync.test.ts's, must
 * never see it) on `outDir`'s own filesystem (never `os.tmpdir()`, which
 * may be a different mount and would make the final rename fail EXDEV). Its
 * name carries exactly one leading dot and no dot in the tail, so it stays
 * invisible to this directory's shallow extension-filtered listing gates
 * (`/\.[cm]?[jt]s$/`). It is removed on every path, success or failure.
 *
 * Takes an --out-dir-shaped option rather than always writing to
 * resources/, so the sync test can build into a scratch directory through
 * this EXACT code path -- the banner must never exist in two
 * implementations.
 */
/** Where to stage a build before renaming artifacts into `outDirAbs`.
 *
 * Two constraints pull in opposite directions, which is why this is its own
 * function rather than an inline `join`:
 *
 * 1. **Same filesystem as `outDirAbs`.** The atomic-replacement guarantee is a
 *    `renameSync()` per artifact, and `rename(2)` fails `EXDEV` across mounts.
 *    That is why the original implementation staged at `dirname(outDirAbs)`.
 * 2. **Outside any directory a test walks.** Staging at `dirname(outDirAbs)`
 *    put a transient `.build-tmp-*` inside `.claude/mcp/vice/`, and
 *    `vice-mcp-selector-docs.test.ts`'s `walkFiles()` recurses through every
 *    directory there except `node_modules` — so a concurrent walk descended
 *    into the staging dir and died `ENOENT` when the rename removed it. That
 *    is a race this very function introduced while fixing a different one
 *    (quick-260804-o09), and constraint 1 is why the obvious fix of "just move
 *    it somewhere else" is not obvious.
 *
 * `node_modules/.cache/` satisfies both **when the default `outDir` is in
 * play**: it is under `HERE`, so same-filesystem; it is the one directory that
 * walk structurally excludes; and `build()` already requires
 * `node_modules/.bin/tsc` to exist, so it can never be absent when a build can
 * run at all.
 *
 * When a caller passes an `outDir` on a *different* device — `resources-sync`
 * builds into a scratch dir, which may be another mount — the preferred
 * location would make every `renameSync()` throw `EXDEV`, so this falls back
 * to the adjacent sibling. That fallback keeps correctness and gives up only
 * walk-invisibility, which costs nothing there: no test walks a scratch dir's
 * parent. Device identity is compared via `statSync().dev` rather than assumed
 * from the path shape. */
export function resolveStagingParent(outDirAbs: string): string {
  const adjacent = dirname(outDirAbs);
  const preferred = join(HERE, "node_modules", ".cache");
  try {
    mkdirSync(preferred, { recursive: true });
    if (statSync(preferred).dev === statSync(adjacent).dev) return preferred;
  } catch {
    // node_modules absent or unwritable -- fall through to the adjacent
    // sibling, which is where this always used to stage.
  }
  return adjacent;
}

export function build({ outDir = "resources" }: BuildOptions = {}): void {
  const outDirAbs = resolveOutDirAbs(outDir);
  // Runs first, and MUST: when resolveStagingParent() falls back to the
  // adjacent sibling, recursive mkdirSync of outDirAbs is what guarantees that
  // parent directory exists before mkdtempSync needs it.
  mkdirSync(outDirAbs, { recursive: true });

  const stagingDir = mkdtempSync(join(resolveStagingParent(outDirAbs), ".build-tmp-" + process.pid + "-"));
  try {
    const tscBin = join(HERE, "node_modules", ".bin", "tsc");
    execFileSync(tscBin, ["-p", join(HERE, "tsconfig.build.json"), "--outDir", stagingDir], {
      cwd: HERE,
      stdio: "inherit",
    });

    const emitted = emittedMjsFilesUnder(stagingDir);
    const expected = [...HOST_BOUND_ARTIFACTS].sort();
    const missing = expected.filter((f) => !emitted.includes(f));
    const unexpected = emitted.filter((f) => !expected.includes(f));

    if (missing.length > 0 || unexpected.length > 0) {
      throw new Error(
        "build: emitted file set does not match HOST_BOUND_ARTIFACTS.\n" +
          `  expected:   ${JSON.stringify(expected)}\n` +
          `  emitted:    ${JSON.stringify(emitted)}\n` +
          `  missing:    ${JSON.stringify(missing)}\n` +
          `  unexpected: ${JSON.stringify(unexpected)}`
      );
    }

    // Banner every staged artifact BEFORE any rename -- a half-bannered
    // file must never become reachable at an `outDir` path.
    for (const rel of HOST_BOUND_ARTIFACTS) {
      const staged = join(stagingDir, rel);
      const banner = GENERATED_BANNER(sourceRelForEmitted(rel));
      const content = readFileSync(staged, "utf8");
      if (!content.startsWith(banner)) {
        writeFileSync(staged, banner + content);
      }
    }

    // Move each finished artifact into place. Iterates the artifact list,
    // not a walk of stagingDir, so a hand-authored file that also lives
    // under outDir (resources/vice-launcher.sh) is never a rename source or
    // target -- it was never staged and is left untouched.
    for (const rel of HOST_BOUND_ARTIFACTS) {
      const from = join(stagingDir, rel);
      const to = join(outDirAbs, rel);
      try {
        renameSync(from, to);
      } catch (e) {
        const detail = (e as NodeJS.ErrnoException).code === "EXDEV" ? " (EXDEV: staging dir and outDir are on different filesystems -- outDir must be reachable via a same-filesystem sibling)" : "";
        throw new Error(`build: failed to move staged artifact into place: ${from} -> ${to}${detail}`, { cause: e });
      }
    }

    // tsc emits exactly HOST_BOUND_ARTIFACTS today (verified). A leftover
    // here means the compiler started emitting something this list does not
    // describe -- fail loudly rather than silently drop a file that used to
    // reach outDir.
    const leftovers = readdirSync(stagingDir);
    if (leftovers.length > 0) {
      throw new Error(
        `build: staging directory still holds file(s) after moving every HOST_BOUND_ARTIFACTS entry -- ` +
          `the compiler emitted something not in that list: ${JSON.stringify(leftovers)}`
      );
    }
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

// -------------------------------------------------------------------- CLI
function parseCliArgs(argv: string[]): BuildOptions {
  let outDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out-dir") {
      outDir = argv[i + 1];
      i++;
    }
  }
  return outDir ? { outDir } : {};
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseCliArgs(process.argv.slice(2));
  try {
    build(opts);
    const outDirAbs = resolveOutDirAbs(opts.outDir ?? "resources");
    process.stderr.write(`build: wrote ${HOST_BOUND_ARTIFACTS.length} artifact(s) to ${outDirAbs}\n`);
  } catch (e) {
    process.stderr.write(`build: FAILED -- ${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}
