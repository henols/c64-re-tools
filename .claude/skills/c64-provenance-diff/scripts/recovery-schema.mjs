#!/usr/bin/env node
// The N-way release-registry invariant validator, and the release-name
// parameterisation gate. Neither touches the emulator; both are pure
// Node/filesystem checks over `recovery/RELEASES.json` and the files it
// references, run entirely offline.
//
// This is the mechanical enforcement of 01-01-PLAN.md's assumption_delta
// decision: the registry is release-CENTRIC (N releases, each a full field
// set, `canonical` demoted to a boolean on one entry), never
// canonical-image-centric again. A future plan that quietly reintroduces a
// privileged singular image, or hardcodes a release name into control flow,
// fails loudly here instead of silently regressing the model.
//
// Every failure names the release, the file, and the field -- never a bare
// "validation failed" -- per this plan's own instruction.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, extname } from "node:path";

import { loadRegistry, registryPath } from "../../c64-ram-capture/scripts/releases.mjs";
import { projectRoot, dataRoot, disksRoot } from "../../c64-ram-capture/scripts/project-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = projectRoot();
const RECOVERY_DIR = dataRoot();
const DISKS_DIR = disksRoot();
// The parameterisation gate must cover EVERY module of the recovery pipeline, not
// just the ones sitting next to this file. When the six modules moved out of
// `tools/` into the two skills that use them (2026-08-04), a `HERE`-only scan
// silently stopped covering `d64-parse.mjs` and `dump-artifacts.mjs` -- a static
// guard that keeps passing while checking less is worse than one that fails.
const SCAN_DIRS = [
  HERE, // .claude/skills/c64-provenance-diff/scripts
  resolve(REPO_ROOT, ".claude", "skills", "c64-ram-capture", "scripts"),
];

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function rel(p) {
  return relative(REPO_ROOT, p);
}

// ---------------------------------------------------------------- validate

const REQUIRED_DUMP_FILE_FIELDS = ["bin", "capture_record", "chip_state", "range_manifest"];

// Directories under recovery/ that are NOT per-release directories and are
// never expected to have a matching releases[] entry: `clean/` is the
// canonical-image projection (checked separately, below), and `machine/`
// holds machine-level (not release-level) evidence -- the power-on baseline
// and decay-prone address set captured once per emulator, with no release
// identity of its own (see tools/recover.mjs's `baseline`/`decay-reference`
// verbs).
const NON_RELEASE_DIRS = ["clean", "machine"];

/**
 * Base invariants, checked on every `validate` run regardless of `--final`.
 * Returns a flat list of addressed error strings (each names the release,
 * file, and/or field involved) -- never a bare boolean.
 */
function runBaseChecks(registry) {
  const errors = [];
  const releases = registry.releases;

  // -- directory <-> registry entry correspondence: no orphan on either side --
  const dirEntries = readdirSync(RECOVERY_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !NON_RELEASE_DIRS.includes(d.name))
    .map((d) => d.name);
  const registryIds = releases.map((r) => r.id);

  for (const dirName of dirEntries) {
    if (!registryIds.includes(dirName)) {
      errors.push(`orphan directory recovery/${dirName}/ has no matching releases[] entry (known ids: ${registryIds.join(", ")})`);
    }
  }
  for (const id of registryIds) {
    if (!dirEntries.includes(id)) {
      errors.push(`releases[] entry "${id}" has no matching recovery/${id}/ directory`);
    }
  }

  // -- every release conforms to the same field set --
  if (releases.length > 0) {
    const canonicalFieldSet = Object.keys(releases[0]).sort().join(",");
    for (const r of releases) {
      const fieldSet = Object.keys(r).sort().join(",");
      if (fieldSet !== canonicalFieldSet) {
        errors.push(
          `release "${r.id}" has a different field set than release "${releases[0].id}" -- ` +
            `got [${Object.keys(r).sort().join(", ")}], expected [${Object.keys(releases[0]).sort().join(", ")}]`
        );
      }
    }
  }

  // -- at most one canonical:true, and the designation is a field, never a --
  // -- directory name or filename --
  const canonicalReleases = releases.filter((r) => r.canonical === true);
  if (canonicalReleases.length > 1) {
    errors.push(
      `more than one release carries canonical:true -- ${canonicalReleases.map((r) => r.id).join(", ")}. ` +
        `At most one release may be canonical.`
    );
  }

  // -- each release's disk_sha256 still matches the file under disks/ --
  for (const r of releases) {
    const diskPath = join(REPO_ROOT, r.disk_image);
    if (!existsSync(diskPath)) {
      errors.push(`release "${r.id}": disk_image "${r.disk_image}" does not exist on disk`);
      continue;
    }
    const actual = sha256File(diskPath);
    if (actual !== r.disk_sha256) {
      errors.push(
        `release "${r.id}": disk_sha256 field "${r.disk_sha256}" does not match the actual sha256 of ` +
          `${r.disk_image} ("${actual}") -- the evidence file may have been mutated`
      );
    }
  }

  // -- every dumps[] entry names four existing files; the bin's sha256 --
  // -- matches the file on disk --
  for (const r of releases) {
    for (const d of r.dumps ?? []) {
      for (const field of REQUIRED_DUMP_FILE_FIELDS) {
        const value = d[field];
        if (!value) {
          errors.push(`release "${r.id}" dump "${d.label}": field "${field}" is not set (a dump is a four-file set, per D-04/D-02)`);
          continue;
        }
        const filePath = join(REPO_ROOT, value);
        if (!existsSync(filePath)) {
          errors.push(`release "${r.id}" dump "${d.label}": field "${field}" names "${value}", which does not exist`);
        }
      }
      if (d.bin && existsSync(join(REPO_ROOT, d.bin))) {
        const actual = sha256File(join(REPO_ROOT, d.bin));
        if (d.sha256 && actual !== d.sha256) {
          errors.push(
            `release "${r.id}" dump "${d.label}": recorded sha256 "${d.sha256}" does not match the actual ` +
              `sha256 of ${d.bin} ("${actual}")`
          );
        }
      }
    }
  }

  // -- `<data root>/clean/*.bin`, when present, is a PROJECTION: exactly one --
  // -- canonical release, and the file byte-identical to that release's --
  // -- primary dump. --
  //
  // The clean copy is DISCOVERED rather than named, so this works whatever a
  // project calls its projection. Naming one specific file meant the check
  // silently passed for every project that named it anything else -- a guard
  // that quietly stops guarding is worse than one that fails.
  const cleanDir = join(RECOVERY_DIR, "clean");
  const cleanBins = existsSync(cleanDir)
    ? readdirSync(cleanDir).filter((f) => f.toLowerCase().endsWith(".bin")).sort()
    : [];

  if (cleanBins.length > 1) {
    errors.push(
      `${rel(cleanDir)} holds ${cleanBins.length} .bin files (${cleanBins.join(", ")}) -- ` +
        `the clean projection must be a single file, otherwise there is no way to tell which one ` +
        `is the projection of the canonical release`
    );
  } else if (cleanBins.length === 1) {
    const cleanBinPath = join(cleanDir, cleanBins[0]);
    const cleanName = rel(cleanBinPath);
    if (canonicalReleases.length !== 1) {
      errors.push(
        `${cleanName} exists, but ${canonicalReleases.length} releases carry canonical:true ` +
          `(expected exactly 1) -- the projection has no single source to be a projection OF`
      );
    } else {
      const canonicalRelease = canonicalReleases[0];
      const primaryDump = (canonicalRelease.dumps ?? [])[0];
      if (!primaryDump || !primaryDump.bin || !existsSync(join(REPO_ROOT, primaryDump.bin))) {
        errors.push(
          `${cleanName} exists, but canonical release "${canonicalRelease.id}" has no ` +
            `primary dump with an existing .bin to compare against`
        );
      } else {
        const cleanHash = sha256File(cleanBinPath);
        const primaryHash = sha256File(join(REPO_ROOT, primaryDump.bin));
        if (cleanHash !== primaryHash) {
          errors.push(
            `${cleanName} (sha256 ${cleanHash}) is NOT byte-identical to canonical release ` +
              `"${canonicalRelease.id}"'s primary dump ${primaryDump.bin} (sha256 ${primaryHash}) -- ` +
              `the clean copy must be an exact projection, never an independent artifact`
          );
        }
      }
    }
  }

  return errors;
}

/** End-of-phase-only assertions, added by `validate --final`. */
function runFinalChecks(registry) {
  const errors = [];
  const releases = registry.releases;

  for (const r of releases) {
    for (const d of r.dumps ?? []) {
      if (!d.range_manifest) continue; // already reported by runBaseChecks
      const manifestPath = join(REPO_ROOT, d.range_manifest);
      if (!existsSync(manifestPath)) continue; // already reported by runBaseChecks
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.classification_state !== "bucketed") {
        errors.push(
          `release "${r.id}" dump "${d.label}": range_manifest ${d.range_manifest} has classification_state ` +
            `"${manifest.classification_state}", expected "bucketed" at the end of the phase`
        );
      }
      const unclassified = (manifest.ranges ?? []).filter((rg) => rg.kind === "unclassified");
      if (unclassified.length > 0) {
        errors.push(
          `release "${r.id}" dump "${d.label}": range_manifest ${d.range_manifest} still has ` +
            `${unclassified.length} range(s) with the transient kind "unclassified" -- must be fully bucketed`
        );
      }
    }

    if (!r.trigger || r.trigger.address == null) {
      errors.push(`release "${r.id}": trigger.address is null -- every release needs a non-null recorded trigger by the end of the phase`);
    }
  }

  const canonicalReleases = releases.filter((r) => r.canonical === true);
  if (canonicalReleases.length !== 1) {
    errors.push(
      `exactly one release must carry canonical:true at the end of the phase -- found ${canonicalReleases.length} ` +
        `(${canonicalReleases.map((r) => r.id).join(", ") || "none"})`
    );
  }

  return errors;
}

export function validateRegistry({ final = false } = {}) {
  const registry = loadRegistry();
  const errors = [...runBaseChecks(registry)];
  if (final) errors.push(...runFinalChecks(registry));
  return { ok: errors.length === 0, final, errors };
}

/** Validate a single release directory's shape against a loaded registry entry. */
export function validateReleaseDir(id) {
  const registry = loadRegistry();
  const r = registry.releases.find((x) => x.id === id);
  if (!r) return { ok: false, errors: [`no releases[] entry for "${id}"`] };
  const dirPath = join(RECOVERY_DIR, id);
  if (!existsSync(dirPath)) return { ok: false, errors: [`recovery/${id}/ does not exist`] };
  const errors = [];
  for (const d of r.dumps ?? []) {
    for (const field of REQUIRED_DUMP_FILE_FIELDS) {
      if (!d[field]) errors.push(`release "${id}" dump "${d.label}": field "${field}" is not set`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ------------------------------------------------------- check-parameterisation

function listMjsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMjsFiles(full));
    else if (entry.isFile() && extname(entry.name) === ".mjs") out.push(full);
  }
  return out;
}

// Matches a registry release id used as the operand of a conditional
// comparison or a switch/case label -- exactly the "branch on a release
// identifier" antipattern this gate exists to catch. A bare string literal
// elsewhere (a fixture path in a test, a usage example) does not match any
// of these and is not flagged.
function conditionalPatternsFor(id) {
  const q = `["'\`]${id}["'\`]`;
  return [
    new RegExp(`===\\s*${q}`),
    new RegExp(`${q}\\s*===`),
    new RegExp(`[^=!]==\\s*${q}`),
    new RegExp(`${q}\\s*==[^=]`),
    new RegExp(`!==\\s*${q}`),
    new RegExp(`${q}\\s*!==`),
    new RegExp(`case\\s+${q}\\s*:`),
  ];
}

// A CALL of the forbidden tool, as opposed to its name appearing in a
// comment, a doc string, or (elsewhere in the project, never under tools/) a
// deny-list array literal.
const DENY_LIST_CALL_PATTERN = /\bcall(?:Tool)?\s*\(\s*["'`]vice_disk_list["'`]/;

export function checkParameterisation({ toolsDir = SCAN_DIRS } = {}) {
  const registry = loadRegistry();
  const ids = registry.releases.map((r) => r.id);
  const dirs = (Array.isArray(toolsDir) ? toolsDir : [toolsDir]).filter((d) => existsSync(d));
  const files = dirs.flatMap((d) => listMjsFiles(d));

  const violations = [];
  const denyListCallViolations = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const relFile = rel(file);
    for (const id of ids) {
      for (const pattern of conditionalPatternsFor(id)) {
        if (pattern.test(content)) {
          violations.push({ file: relFile, release: id, pattern: pattern.source });
        }
      }
    }
    if (DENY_LIST_CALL_PATTERN.test(content)) {
      denyListCallViolations.push(relFile);
    }
  }

  return {
    ok: violations.length === 0 && denyListCallViolations.length === 0,
    filesScanned: files.length,
    releaseIds: ids,
    violations,
    denyListCallViolations,
  };
}

// -------------------------------------------------------------------- CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const jsonFlag = rest.includes("--json");
  const finalFlag = rest.includes("--final");

  function run() {
    if (cmd === "validate") {
      const result = validateRegistry({ final: finalFlag });
      if (jsonFlag) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log(`validate${finalFlag ? " --final" : ""}: OK (registry ${rel(registryPath)})`);
      } else {
        console.error(`validate${finalFlag ? " --final" : ""}: FAILED with ${result.errors.length} error(s):`);
        for (const e of result.errors) console.error(`  - ${e}`);
      }
      process.exitCode = result.ok ? 0 : 1;
      return;
    }
    if (cmd === "check-parameterisation") {
      const result = checkParameterisation();
      if (jsonFlag) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`check-parameterisation: scanned ${result.filesScanned} file(s) across the pipeline scripts dirs against release ids [${result.releaseIds.join(", ")}]`);
        for (const v of result.violations) {
          console.error(`  - ${v.file}: release id "${v.release}" appears in a conditional (matched /${v.pattern}/)`);
        }
        for (const f of result.denyListCallViolations) {
          console.error(`  - ${f}: calls the forbidden vice_disk_list tool directly`);
        }
        console.log(result.ok ? "check-parameterisation: OK" : "check-parameterisation: FAILED");
      }
      process.exitCode = result.ok ? 0 : 1;
      return;
    }
    console.log(`usage: node ${fileURLToPath(import.meta.url)} <validate [--final]|check-parameterisation> [--json]`);
    process.exitCode = cmd ? 1 : 0;
  }

  run();
}
