// node:test coverage of install-resources.ts's deploy-on-first-use
// installer -- rescued from vice-pool.test.mjs (quick-260730-q4b Task 2,
// quick-260731-p8a) before that file is deleted wholesale in plan 04.
// install-resources.ts SURVIVES D-02/D-05, and this is the ONLY test file
// its guarantees have ever had -- criterion 9 rests on it, and plan 03
// converted install-resources.mjs to TypeScript and needed this file's
// red/green signal to do so safely.
//
// Every test here drives installResources()/ensureResourcesInstalled()
// against a SYNTHETIC temp root (mkdtempSync) so no test ever writes into
// the real repo's tools/ -- matching vice-pool.test.mjs's own existing
// temp-directory idiom. Nothing here imports vice-pool.mjs or
// vice-session.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  RESOURCES_DIR,
  installTargetDir,
  resourceEntries,
  installResources,
  ensureResourcesInstalled,
  hostLaunchInstructions,
  DEPLOY_MANIFEST_NAME,
  deployManifestPath,
  readDeployManifest,
  writeDeployManifest,
  pruneResources,
  type InstallResourcesResult,
  type PruneResourcesResult,
} from "./install-resources.ts";
import { containerGuardReport, containerGuardEnforce } from "./container-guard.mts";

const execFileP = promisify(execFile);

test("RESOURCES_DIR (quick-260731-p8a, path-anchor regression): points at the MODULE DIRECTORY's resources/, not a scripts/-relative directory", () => {
  // A wrong hop count here is SILENT, because ensureResourcesInstalled()
  // swallows every error by contract -- see install-resources.mjs's header.
  // Asserting the exact entry set (not just "no throw") is what makes this
  // non-vacuous: a directory that resolves to somewhere with NO resources/
  // subdirectory makes readdirSync() throw loudly inside resourceEntries(),
  // so this test dies instead of quietly comparing two empty lists.
  assert.ok(
    RESOURCES_DIR.endsWith(join("mcp", "vice", "resources")),
    `expected RESOURCES_DIR to end with mcp/vice/resources, got ${RESOURCES_DIR}`
  );
  assert.ok(
    !RESOURCES_DIR.split(sep).includes("scripts"),
    `expected RESOURCES_DIR to NOT pass through a scripts/ segment, got ${RESOURCES_DIR}`
  );
  // Derived from resourceEntries() itself rather than a hardcoded list of
  // filenames -- so this test never needs an edit when a resource is added
  // or removed (plan 03's prune, plan 04's deletion of vice-pool.sh). Its
  // ONLY job is proving the anchor points somewhere non-empty and shaped
  // right, per the two structural assertions above -- a wrong hop count
  // still fails loudly there, not here.
  const entries = resourceEntries();
  assert.ok(entries.length > 0, "expected at least one deployed resource under RESOURCES_DIR");
  assert.ok(entries.includes("vice-broker.mjs"), "expected vice-broker.mjs (the compiled broker artifact) to still be a tracked resource");
  assert.ok(entries.includes("vice-launcher.sh"), "expected vice-launcher.sh (plan 01) to be a tracked resource");
});

test("installResources(): install-when-missing -- every file under resources/ lands at <root>/tools/<same relative path>", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-missing-"));
  const entries = resourceEntries();
  const result = installResources({ root, log: () => {} });
  assert.deepEqual([...result.installed].sort(), [...entries].sort());
  assert.equal(result.skipped.length, 0);
  assert.equal(result.diverged.length, 0);
  assert.equal(result.failed.length, 0);
  for (const entry of entries) {
    assert.ok(existsSync(join(installTargetDir(root), entry)), `expected ${entry} to be deployed`);
  }
});

test("installResources(): no-op-when-present -- a second run reports nothing installed and leaves mtimes untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-noop-"));
  installResources({ root, log: () => {} });
  const target = join(installTargetDir(root), "vice-broker.mjs");
  const mtimeBefore = statSync(target).mtimeMs;

  const result = installResources({ root, log: () => {} });

  assert.equal(result.installed.length, 0, "expected nothing installed on a second run");
  assert.ok(result.skipped.includes("vice-broker.mjs"), "expected the already-present entry to be reported skipped");
  assert.equal(statSync(target).mtimeMs, mtimeBefore, "mtime must be untouched by a no-op run");
});

test("installResources(): no-overwrite-when-diverged (hand-authored) -- a hand-edited HAND-AUTHORED target (vice-launcher.sh) is reported diverged, left byte-for-byte unchanged, and the refusal is logged loudly (260805 stale-deploy fix)", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-diverged-handauthored-"));
  installResources({ root, log: () => {} });
  const target = join(installTargetDir(root), "vice-launcher.sh");
  writeFileSync(target, "#!/usr/bin/env bash\n# edited by hand\n");

  const warnings: string[] = [];
  const result = installResources({ root, log: (m) => warnings.push(m) });

  assert.ok(result.diverged.includes("vice-launcher.sh"), "expected the hand-edited HAND-AUTHORED entry to be reported diverged");
  assert.equal(result.installed.length, 0, "a hand-authored divergence must never be auto-overwritten");
  assert.equal(readFileSync(target, "utf8"), "#!/usr/bin/env bash\n# edited by hand\n", "the hand edit must survive byte-for-byte");
  assert.ok(
    warnings.some((w) => /refus/i.test(w) && w.includes("vice-launcher.sh")),
    "expected the per-entry refusal to be logged loudly, naming the entry"
  );
  assert.ok(
    warnings.some((w) => /1 hand-authored entrie\(s\) refused/.test(w)),
    "expected the count-carrying summary warning so a refused divergence can never read as silent success"
  );
});

test("installResources(): diverged GENERATED artifact is overwritten by DEFAULT, no force needed -- staleness is the only thing divergence can mean for a generated file (260805 stale-deploy fix)", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-diverged-generated-"));
  installResources({ root, log: () => {} });
  const target = join(installTargetDir(root), "vice-broker.mjs");
  const original = readFileSync(target);
  writeFileSync(target, "// stale -- predates the current resources/ content\n");

  const notes: string[] = [];
  const result = installResources({ root, log: (m) => notes.push(m) });

  assert.ok(result.installed.includes("vice-broker.mjs"), "expected the diverged GENERATED entry to be auto-refreshed without force");
  assert.equal(result.diverged.length, 0, "a generated artifact's divergence must never be reported as refused");
  assert.ok(readFileSync(target).equals(original), "the stale generated artifact must be restored to resources/ content");
  assert.ok(
    notes.some((n) => n.includes("vice-broker.mjs") && /refreshing it automatically/.test(n)),
    "expected the auto-refresh to be logged, distinguishing it from a silent no-op"
  );
});

test("installResources({ force: true }): restores a diverged GENERATED target to the resources/ content, unchanged from before this fix", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-force-"));
  installResources({ root, log: () => {} });
  const target = join(installTargetDir(root), "vice-broker.mjs");
  const original = readFileSync(target);
  writeFileSync(target, "// edited by hand\n");

  const result = installResources({ root, force: true, log: () => {} });

  assert.ok(result.installed.includes("vice-broker.mjs"), "expected the forced overwrite to be reported as installed");
  assert.ok(readFileSync(target).equals(original), "forced install must restore the exact resources/ content");
});

test("installResources({ force: true }): still overwrites a diverged HAND-AUTHORED target too -- force strips protection from vice-launcher.sh exactly as before this fix", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-force-handauthored-"));
  installResources({ root, log: () => {} });
  const target = join(installTargetDir(root), "vice-launcher.sh");
  const original = readFileSync(target);
  writeFileSync(target, "#!/usr/bin/env bash\n# edited by hand\n");

  const result = installResources({ root, force: true, log: () => {} });

  assert.ok(result.installed.includes("vice-launcher.sh"), "expected the forced overwrite of the hand-authored entry to be reported as installed");
  assert.equal(result.diverged.length, 0, "force must never report anything as refused");
  assert.ok(readFileSync(target).equals(original), "forced install must restore the exact resources/ content even for the hand-authored entry");
});

test("installResources(): executable bit preserved -- the surviving launcher arrives executable, a compiled broker artifact non-executable like its tracked source", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-modes-"));
  installResources({ root, log: () => {} });
  const launcher = join(installTargetDir(root), "vice-launcher.sh");
  const broker = join(installTargetDir(root), "vice-broker.mjs");

  assert.ok(statSync(launcher).mode & 0o111, "vice-launcher.sh (plan 01's launcher) must be deployed executable -- it is exec'd directly");
  assert.equal(statSync(broker).mode & 0o111, 0, "vice-broker.mjs must NOT be executable, matching its tracked (node-invoked, never exec'd directly) source mode");
});

test("installResources(): a real install writes its host-launch instructions to stderr only, never stdout (D-4)", async () => {
  // Fresh process, not this test file's own already-imported module -- the
  // stdout/stderr split is only meaningful observed from outside the
  // process that's doing the writing.
  const root = mkdtempSync(join(tmpdir(), "vice-install-stderr-"));
  const src = `
    import { installResources } from ${JSON.stringify(new URL("./install-resources.ts", import.meta.url).href)};
    installResources({ root: ${JSON.stringify(root)} });
  `;
  const { stdout, stderr } = await execFileP(process.execPath, ["--input-type=module", "-e", src]);
  assert.equal(stdout, "", "expected a real install to write an empty stdout");
  assert.match(stderr, /container/i, "expected the container refusal to be named on stderr");
  assert.match(stderr, /--check-container/, "expected the guard diagnostic flag to be named on stderr");
  assert.match(stderr, /ctrl-c/i, "expected the clean-interrupt instruction to be named on stderr");
});

test("ensureResourcesInstalled(): fire-once-per-process -- calling it twice in one process with the target deleted in between does NOT recreate it", async () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-fireonce-"));
  const src = `
    import { ensureResourcesInstalled } from ${JSON.stringify(new URL("./install-resources.ts", import.meta.url).href)};
    import { existsSync, rmSync } from "node:fs";
    import { join } from "node:path";
    const root = ${JSON.stringify(root)};
    const target = join(root, "tools", "vice-broker.mjs");
    ensureResourcesInstalled({ root });
    console.log("first:" + existsSync(target));
    rmSync(target);
    ensureResourcesInstalled({ root });
    console.log("second:" + existsSync(target));
  `;
  const env = { ...process.env };
  delete env.VICE_SKIP_RESOURCE_INSTALL;
  const { stdout } = await execFileP(process.execPath, ["--input-type=module", "-e", src], { env });
  assert.match(stdout, /first:true/);
  assert.match(stdout, /second:false/, "the second call must NOT recreate the deleted file -- fire-once means once per process, not once per file");
});

test("ensureResourcesInstalled(): env opt-out -- VICE_SKIP_RESOURCE_INSTALL=1 makes it do nothing at all", async () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-skipenv-"));
  const src = `
    import { ensureResourcesInstalled } from ${JSON.stringify(new URL("./install-resources.ts", import.meta.url).href)};
    import { existsSync } from "node:fs";
    import { join } from "node:path";
    ensureResourcesInstalled({ root: ${JSON.stringify(root)} });
    console.log(existsSync(join(${JSON.stringify(root)}, "tools", "vice-broker.mjs")));
  `;
  const env = { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1" };
  const { stdout } = await execFileP(process.execPath, ["--input-type=module", "-e", src], { env });
  assert.match(stdout.trim(), /^false$/, "VICE_SKIP_RESOURCE_INSTALL=1 must prevent any deployment at all");
});

test("installResources(): never throws when the target root is unwritable -- it warns per entry through `log` instead (D-3)", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-unwritable-"));
  chmodSync(root, 0o500); // read+execute, no write -- mkdirSync/copyFileSync must fail for every entry
  const warnings: string[] = [];
  try {
    let result: InstallResourcesResult | undefined;
    assert.doesNotThrow(() => {
      result = installResources({ root, log: (msg) => warnings.push(msg) });
    });
    assert.ok(result!.failed.length > 0, "expected every entry to fail against an unwritable root");
    assert.ok(warnings.length > 0, "expected at least one warning logged instead of a thrown exception");
  } finally {
    chmodSync(root, 0o700); // restore so the temp dir can be cleaned up
  }
});

// ============================================================================
// Plan 03, Task 1: pruneResources()/readDeployManifest()/writeDeployManifest()
// -- the delete half installResources() never had (RESEARCH.md's Runtime
// State Inventory). Every test below drives a SYNTHETIC temp root, same
// idiom as the rest of this file; nothing here ever touches the real repo's
// tools/.
// ============================================================================

test("readDeployManifest(): a missing, malformed, or shape-wrong manifest reads as an empty list -- never throws (T-01.6-13)", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-manifest-malformed-"));
  assert.deepEqual(readDeployManifest(root), [], "a missing manifest file must read as an empty list");

  const manifestPath = deployManifestPath(root);
  mkdirSync(dirname(manifestPath), { recursive: true });

  writeFileSync(manifestPath, "not json at all {{{");
  assert.deepEqual(readDeployManifest(root), [], "malformed JSON must read as an empty list");

  writeFileSync(manifestPath, JSON.stringify(["a", "b"]));
  assert.deepEqual(readDeployManifest(root), [], "a non-object top-level shape (bare array) must read as an empty list");

  writeFileSync(manifestPath, JSON.stringify({ entries: "not-an-array" }));
  assert.deepEqual(readDeployManifest(root), [], "a non-array entries field must read as an empty list");

  writeFileSync(manifestPath, JSON.stringify({ entries: ["vice-broker.mjs"] }));
  assert.deepEqual(readDeployManifest(root), ["vice-broker.mjs"], "a well-formed manifest must read back its entries");
});

test("writeDeployManifest()/readDeployManifest(): round-trips a sorted entry list", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-manifest-roundtrip-"));
  writeDeployManifest(root, ["b.sh", "a.sh", "lib/c.sh"]);
  assert.deepEqual(readDeployManifest(root), ["a.sh", "b.sh", "lib/c.sh"]);
  assert.ok(existsSync(join(installTargetDir(root), DEPLOY_MANIFEST_NAME)), "the manifest file must exist at the documented path");
});

test("installResources(): a full install-then-prune round trip leaves the manifest equal to the current resourceEntries() set", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-install-manifest-sync-"));
  installResources({ root, log: () => {} });
  assert.deepEqual([...readDeployManifest(root)].sort(), [...resourceEntries()].sort());
});

test("pruneResources(): a manifest entry naming a file no longer in resources/ is removed from the deployment target", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-prune-retired-"));
  installResources({ root, log: () => {} });
  const survivor = join(installTargetDir(root), "vice-broker.mjs");
  assert.ok(existsSync(survivor), "sanity: vice-broker.mjs must exist before the retirement is simulated");

  // Simulate a retirement: a manifest naming a file that is no longer a
  // current resource, with that file actually present on disk (as a real
  // prior deploy would have left it).
  const staleTarget = join(installTargetDir(root), "vice-pool-retired.sh");
  writeFileSync(staleTarget, "# stale retired script\n");
  writeDeployManifest(root, [...resourceEntries(), "vice-pool-retired.sh"]);

  const result = pruneResources({ root, log: () => {} });

  assert.ok(result.pruned.includes("vice-pool-retired.sh"), "expected the retired entry to be pruned");
  assert.ok(!existsSync(staleTarget), "the retired file must actually be removed from disk");
  assert.ok(existsSync(survivor), "a still-current resource must never be touched by the prune");
});

test("pruneResources(): a file present under the deployment target but ABSENT from the manifest is left untouched -- this is what protects tracked reverse-engineering tooling sharing tools/", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-prune-untracked-"));
  installResources({ root, log: () => {} });
  // Simulate tools/d64-parse.mjs: tracked reverse-engineering tooling this
  // installer never deployed and never recorded in its own manifest.
  const untracked = join(installTargetDir(root), "d64-parse.mjs");
  writeFileSync(untracked, "// tracked reverse-engineering tooling, not a deployed resource\n");

  const result = pruneResources({ root, log: () => {} });

  assert.ok(!result.pruned.includes("d64-parse.mjs"), "a file absent from the manifest must never be pruned, even though it is not a current resource");
  assert.ok(existsSync(untracked), "the untracked, tracked-in-git file must survive the prune untouched");
});

test("pruneResources(): a manifest entry containing a parent-directory hop is refused before any filesystem access, and reported skipped", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-prune-escape-parent-"));
  installResources({ root, log: () => {} });

  const escapee = "../outside-the-target.txt";
  writeDeployManifest(root, [...resourceEntries(), escapee]);

  const warnings: string[] = [];
  const result = pruneResources({ root, log: (m) => warnings.push(m) });

  assert.ok(result.skipped.includes(escapee), "expected the escaping entry to be reported skipped");
  assert.equal(result.pruned.length, 0, "nothing should be pruned when the only retired candidate escapes the target");
  assert.ok(warnings.some((w) => /refus|parent-directory|escape/i.test(w)), "expected a warning naming why the entry was refused");
});

test("pruneResources(): an absolute-path manifest entry is refused and reported skipped", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-prune-escape-absolute-"));
  installResources({ root, log: () => {} });

  const escapee = "/etc/passwd";
  writeDeployManifest(root, [...resourceEntries(), escapee]);

  const result = pruneResources({ root, log: () => {} });

  assert.ok(result.skipped.includes(escapee), "expected an absolute-path entry to be refused and reported skipped");
  assert.equal(result.pruned.length, 0, "nothing should be pruned when the only retired candidate is an absolute path");
  assert.ok(existsSync("/etc/passwd"), "sanity: the real /etc/passwd must survive completely untouched");
});

// ============================================================================
// Plan 01.6.2-09 (D-23, T-01.6.2-56): hostLaunchInstructions() used to
// return TWO paragraphs -- one repointable (the broker launcher) and one
// advertising a standalone (non-MCP) recovery pipeline whose own scripts
// were already deleted behind a zero-consumers gate in an earlier phase
// (01.6-CONTEXT.md D-02). That second paragraph is DELETED here, not
// repointed -- swapping its path would keep advertising a capability that
// no longer exists. This was never covered by a test before this plan.
// ============================================================================

test("hostLaunchInstructions(): contains exactly one resolved host path, names the surviving launcher, and advertises no standalone recovery pipeline", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-hostlaunch-"));
  const text = hostLaunchInstructions(root);

  // Counted by the launcher's own basename, not the full absolute path --
  // hostPath() may translate installTargetDir(root) into a different HOST
  // path (or degrade to the container path plus SET_ENV_HINT) depending on
  // this test process's own mount view, but "vice-launcher.sh" survives
  // either way as the resolved path's own final path segment.
  const occurrences = (text.match(/vice-launcher\.sh/g) || []).length;
  assert.equal(occurrences, 1, `expected exactly one resolved host path (naming vice-launcher.sh) in hostLaunchInstructions(), found ${occurrences}`);

  assert.doesNotMatch(text, /vice-supervisor\.sh/, "must not still name the retiring per-instance supervisor");
  assert.doesNotMatch(text, /vice-broker\.sh/, "must not still name the retiring bash broker by its own filename");
  assert.doesNotMatch(text, /standalone/i, "must not advertise the standalone (non-MCP) recovery pipeline -- its scripts are already gone");
  assert.doesNotMatch(text, /recovery pipeline/i, "must not advertise a recovery pipeline whose scripts no longer exist");

  assert.match(text, /on-demand broker/i, "must describe the broker's on-demand launch");
  assert.match(text, /respawn/i, "must describe the broker respawning a crashed instance with backoff");
});

test("hostLaunchInstructions(): the named exit codes match what containerGuardEnforce()/containerGuardReport() actually return in this (containerized) environment", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-hostlaunch-exitcodes-"));
  const text = hostLaunchInstructions(root);

  // This test process is itself running inside the devcontainer, so both
  // guard functions fire for real here -- no stubbed deps needed. Plan 01's
  // own container-guard.test.ts asserts the SAME two values (2 refuse, 3
  // report); this test compares hostLaunchInstructions()'s PROSE against
  // those same live-computed numbers rather than a second hardcoded literal.
  const enforceRc = containerGuardEnforce();
  const reportRc = containerGuardReport();
  assert.equal(enforceRc, 2, "sanity: containerGuardEnforce() must refuse with exit 2 inside this container");
  assert.equal(reportRc, 3, "sanity: containerGuardReport() must report exit 3 inside this container");

  assert.match(text, new RegExp(`exit ${enforceRc}\\b`), `hostLaunchInstructions() must name the guard's actual refusal exit code (${enforceRc})`);
  assert.match(text, /--check-container/, "must name the diagnostic flag for the full per-signal breakdown");
});

test("pruneResources(): an unlink failure on a read-only deployment target is reported as failed, not thrown (D-3)", () => {
  const root = mkdtempSync(join(tmpdir(), "vice-prune-unlinkfail-"));
  installResources({ root, log: () => {} });
  const staleTarget = join(installTargetDir(root), "vice-pool-retired.sh");
  writeFileSync(staleTarget, "# stale\n");
  writeDeployManifest(root, [...resourceEntries(), "vice-pool-retired.sh"]);

  chmodSync(installTargetDir(root), 0o500); // read+execute, no write -- unlink of a file inside requires write on the containing dir
  const warnings: string[] = [];
  try {
    let result: PruneResourcesResult | undefined;
    assert.doesNotThrow(() => {
      result = pruneResources({ root, log: (m) => warnings.push(m) });
    });
    assert.ok(result!.failed.includes("vice-pool-retired.sh"), "expected the unlink failure to be reported as failed");
    assert.ok(warnings.length > 0, "expected a warning logged instead of a thrown exception");
  } finally {
    chmodSync(installTargetDir(root), 0o700); // restore so the temp dir can be cleaned up
  }
});
