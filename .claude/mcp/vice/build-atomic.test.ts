// build-atomic.test.ts
//
// Polices build()'s write path against torn reads. Two other test files are
// the victims when build() writes in place: resources-sync.test.ts, which
// compares the committed resources/ tree against a fresh scratch build and
// can catch a sibling test's build() mid-write; and
// vice-broker-launch.test.ts, whose freshDeployDir() copies artifacts out of
// resources/ and spawns them under bare `node`, so a half-written artifact
// there is not just misread, it is EXECUTED. Both failures are false
// alarms against the pre-fix build() -- the committed tree is correct, the
// read just landed inside another process's write window.
//
// Per-file atomic rename() (no lock) is sufficient here because no test in
// this suite mutates the .mts sources build() compiles: every concurrent
// build, however many run at once, emits byte-identical output. That means
// there is no "which generation won" problem to solve, only "never let a
// reader observe a file that is not yet complete" -- exactly what renaming
// a fully-finished file into place, rather than writing through the final
// path, guarantees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  closeSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build, HOST_BOUND_ARTIFACTS, resolveStagingParent } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

test(
  "a complete file already at the target path is never mutated in place -- a reader holding it open still sees its original bytes, and the path gets a new inode",
  () => {
    const target = mkdtempSync(join(tmpdir(), "build-atomic-inode-"));
    try {
      const sentinelPath = join(target, "vice-broker.mjs");
      const sentinel = "SENTINEL-NOT-COMPILED-OUTPUT";
      writeFileSync(sentinelPath, sentinel);

      const inoBefore = statSync(sentinelPath).ino;
      const fd = openSync(sentinelPath, "r");
      try {
        build({ outDir: target });

        // Explicit position 0 -- the directory entry may now name a
        // different inode (or none, mid-rename), but the held fd still
        // addresses whatever inode it was opened against.
        const size = fstatSync(fd).size;
        const buf = Buffer.alloc(size);
        readSync(fd, buf, 0, size, 0);
        assert.equal(
          buf.toString("utf8"),
          sentinel,
          "the held file descriptor's bytes changed -- build() rewrote the existing inode in place " +
            "instead of renaming a new file over it. A reader holding the old file open must never " +
            "observe the new build's bytes appearing inside its original read."
        );
      } finally {
        closeSync(fd);
      }

      const inoAfter = statSync(sentinelPath).ino;
      assert.notEqual(
        inoAfter,
        inoBefore,
        "the path's inode did not change -- build() must replace the file via rename(), never write " +
          "through the existing path."
      );
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }
);

test(
  "concurrent builds into a shared out-dir never expose a partial or banner-less file to a reader",
  async () => {
    // Honesty note: this test reproduces a race and is therefore
    // probabilistic, unlike the deterministic test above. The banner-less
    // window it targets is present on every build (tsc emits each artifact
    // without the banner; build() prepends it in a second pass), so in
    // practice it reproduces reliably at these settings -- but a race is a
    // race, and the settings below are the ones that were actually observed
    // to turn this test red pre-fix (see SUMMARY.md for the exact
    // round/output).
    const ROUNDS = 5;
    const CONCURRENCY = 3;

    const referenceDir = mkdtempSync(join(tmpdir(), "build-atomic-reference-"));
    const sharedDir = mkdtempSync(join(tmpdir(), "build-atomic-shared-"));
    try {
      build({ outDir: referenceDir });
      const reference = new Map<string, Buffer>();
      for (const rel of HOST_BOUND_ARTIFACTS) {
        reference.set(rel, readFileSync(join(referenceDir, rel)));
      }

      mkdirSync(sharedDir, { recursive: true });

      const tornReads: string[] = [];
      let readerRunning = true;

      async function readerLoop(): Promise<void> {
        while (readerRunning) {
          for (const rel of HOST_BOUND_ARTIFACTS) {
            const path = join(sharedDir, rel);
            let content: Buffer;
            try {
              content = readFileSync(path);
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
              throw e;
            }
            const expected = reference.get(rel)!;
            if (!content.equals(expected)) {
              const startsWithBanner = content.toString("utf8").startsWith("// GENERATED FILE");
              tornReads.push(
                `${rel}: observed ${content.length} bytes (expected ${expected.length}), ` +
                  `startsWithBanner=${startsWithBanner}`
              );
            }
          }
          // Yield to the event loop so the child processes' `exit` events
          // actually get a chance to fire -- a synchronous reader loop
          // starves the loop and the round below hangs forever.
          await new Promise<void>((r) => setImmediate(r));
        }
      }

      const buildScript = join(HERE, "build.ts");

      // The reader must run CONCURRENTLY with the spawned builds -- awaiting
      // it after Promise.all(children) would only ever observe post-build
      // state, where every artifact is already complete by definition.
      const readerDone = readerLoop();

      for (let round = 0; round < ROUNDS && tornReads.length === 0; round++) {
        const exitCodes = await Promise.all(
          Array.from({ length: CONCURRENCY }, () => {
            const child = spawn(process.execPath, [buildScript, "--out-dir", sharedDir], {
              cwd: HERE,
              stdio: "ignore",
            });
            return new Promise<number | null>((resolve) => {
              child.on("exit", (code) => resolve(code));
            });
          })
        );

        for (const code of exitCodes) {
          assert.equal(code, 0, `a concurrent build child exited ${code}, not 0, in round ${round}`);
        }
      }

      readerRunning = false;
      await readerDone;

      assert.deepEqual(
        tornReads,
        [],
        `torn read(s) observed during concurrent builds: ${JSON.stringify(tornReads)}`
      );
    } finally {
      rmSync(referenceDir, { recursive: true, force: true });
      rmSync(sharedDir, { recursive: true, force: true });
    }
  }
);

test(
  "the private temp directory is cleaned up on both the success and the failure path, leaving no sibling of the out-dir behind",
  () => {
    function tempSiblingsOf(dir: string): string[] {
      const parent = dirname(dir);
      return readdirSync(parent).filter((f) => f.startsWith(".build-tmp-"));
    }

    // Success path.
    const successOut = mkdtempSync(join(tmpdir(), "build-atomic-cleanup-ok-"));
    try {
      build({ outDir: successOut });
      assert.deepEqual(
        tempSiblingsOf(successOut),
        [],
        "a .build-tmp- staging directory survived next to the out-dir after a successful build"
      );
      assert.deepEqual(
        readdirSync(successOut).filter((f) => f.startsWith(".build-tmp-")),
        [],
        "a .build-tmp- staging directory survived INSIDE the out-dir after a successful build"
      );
    } finally {
      rmSync(successOut, { recursive: true, force: true });
    }

    // Failure path: pre-create a directory at the destination path so the
    // final rename onto that name cannot possibly succeed.
    const failOut = mkdtempSync(join(tmpdir(), "build-atomic-cleanup-fail-"));
    try {
      mkdirSync(join(failOut, "vice-broker.mjs"));
      assert.throws(() => build({ outDir: failOut }), "build() must throw when a rename target is unusable");
      assert.deepEqual(
        tempSiblingsOf(failOut),
        [],
        "a .build-tmp- staging directory survived next to the out-dir after a FAILED build"
      );
    } finally {
      rmSync(failOut, { recursive: true, force: true });
    }
  }
);

// ------------------------------------------------- staging location (walk safety)
//
// The atomic-write fix (quick-260804-o09) staged at `dirname(outDir)`, which for
// the default outDir is `.claude/mcp/vice/` itself. vice-mcp-selector-docs.test.ts's
// walkFiles() recurses every directory there except node_modules, so a concurrent
// walk descended into the transient staging dir and died ENOENT when the rename
// removed it -- one race traded for another. These pin the corrected location.

test("resolveStagingParent(): the DEFAULT outDir stages inside node_modules/.cache -- the one directory the project's recursive walks structurally exclude", () => {
  const parent = resolveStagingParent(join(HERE, "resources"));
  assert.equal(parent, join(HERE, "node_modules", ".cache"));
  // The point is not the path spelling but that it is NOT the walked tree root.
  assert.notEqual(parent, HERE);
});

test("resolveStagingParent(): falls back to the adjacent sibling for an outDir on another device, so renameSync() can never throw EXDEV", () => {
  // /proc is guaranteed to be a different filesystem from the workspace, and
  // exists on every Linux host this project supports -- a stable way to prove
  // the device check actually branches rather than always returning the
  // preferred path.
  const foreign = "/proc/self";
  if (statSync(foreign).dev === statSync(HERE).dev) {
    // Cannot construct the cross-device case on this host; skip rather than
    // assert something the environment makes untestable.
    return;
  }
  assert.equal(resolveStagingParent(join(foreign, "resources")), foreign);
});

test("a real default build leaves no .build-tmp-* directory in the walked tree, before or after", () => {
  const strayBefore = readdirSync(HERE).filter((n) => n.startsWith(".build-tmp-"));
  assert.deepEqual(strayBefore, [], "precondition: no leaked staging dir from an earlier run");
  build();
  const strayAfter = readdirSync(HERE).filter((n) => n.startsWith(".build-tmp-"));
  assert.deepEqual(strayAfter, [], "a build must not leave a staging dir in the walked tree");
});
