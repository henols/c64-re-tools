// anno-confinement.test.ts -- the workspace-confinement control set for
// `STORE-01`'s write path and `anno-store.ts`'s trap 7: a store write must not
// land outside the workspace root it was confined to.
//
// WHY THIS FILE EXISTS AT ALL. `28-VERIFICATION.md` gap 3 / `28-REVIEW.md`
// CR-03 reproduced a real escape: `storePathWithinWorkspace` compared
// `resolve(path)` against `resolve(workspaceRoot) + sep`, and `resolve()`
// normalises `..` but does NOT follow symbolic links. With `workspaceRoot=<ws>`
// and `<ws>/escape` a symlink to a sibling directory, `openStore(<ws>/escape/
// p.annostore)` SUCCEEDED and the store file was CREATED outside the workspace
// root. The `..` half of the control worked and was pinned; the symlink half
// did not exist, and no test planted a symlink, so the gap was invisible to the
// suite. Every test below exists to make that class of gap visible.
//
// WHY IT IS A SEPARATE FILE rather than more cases in `anno-store.test.ts`.
// Two reasons that survive scrutiny. The confinement fixtures need symlink
// scaffolding of their own (a real directory, a sibling outside the root, and
// links in both directions) and read better as one thing. And NOT editing
// `anno-store.test.ts` keeps its two existing confinement pins running as an
// untouched regression, rather than as assertions this change could have
// quietly adjusted to suit itself. Those two pins remain the authoritative
// `..`/sibling-prefix statement; test 5 below is a locality convenience that
// asserts the same classes, never a weaker property.
//
// THE CONTROL MUST DISCRIMINATE, NOT MERELY REFUSE. A confinement fix that
// refused EVERY symlink would pass test 1 and prove nothing -- it would also
// refuse legitimate layouts. Tests 2 and 6 are what make test 1 meaningful: an
// inside-pointing symlink is FOLLOWED, and a symlinked workspace ROOT does not
// make every path look foreign. A control that only ever refuses is
// indistinguishable from one that works.
//
// SYMLINK SUPPORT IS ASSUMED, DELIBERATELY, AND MUST FAIL LOUDLY. The host's
// `/tmp` here is a tmpfs and supports symlinks. On a filesystem that did not,
// tests 1, 2 and 6 would be vacuous -- so `symlinkSync` is called bare: if it
// throws, the test FAILS rather than skipping. A silently skipped confinement
// control is exactly the state CR-03 was reported from.
//
// THE TEMP ROOT IS REALPATH'D BEFORE USE. `mkdtempSync(join(tmpdir(), ...))`
// can sit under a symlinked `tmpdir()` on some hosts (macOS `/var` ->
// `/private/var`). Resolving it once in the helper keeps tests 1-5 asserting
// what they mean to assert; test 6 plants its OWN symlinked root on purpose.
//
// This file names no `node:sqlite` specifier, so `anno-seam.test.ts`'s declared
// `TEST_FILES_NAMING_SQLITE` list is untouched by its existence. It spawns no
// process and needs no emulator, broker or network, so it needs no
// `MANUAL_ONLY_TESTS` entry in `test-gate.mjs` and joins `automatedTestFiles()`
// automatically. `package.json`'s `files[]` is an explicit list, so it is
// excluded from the published tarball by construction.
//
// NOTHING here asserts stderr is empty, and nothing may: `node:sqlite` emits an
// `ExperimentalWarning` unconditionally on first load.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { closeStore, openStore } from "./anno-store.ts";
import { AnnoStorePathError, storePathWithinWorkspace } from "./anno-types.ts";

/** `anno-store.test.ts`'s `inTempDir` shape -- `mkdtempSync` under `tmpdir()`
 * inside a `try` with an UNCONDITIONAL `finally rmSync`. The one addition is
 * the `realpathSync`: see the header. `/tmp` here is a tmpfs whose periodic
 * cleanup is disabled, so a leaked fixture is leaked RAM until reboot and the
 * `finally` is not decorative. */
function inTempDir(body: (dir: string) => void): void {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "anno-confine-")));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("1. a symlinked subdirectory inside the workspace is REFUSED, and no store file is created outside the root", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);
    // The verifier's exact reproduction, planted: a link INSIDE the workspace
    // whose target is a sibling directory OUTSIDE it.
    symlinkSync(outside, join(ws, "escape"), "dir");

    const storePath = join(ws, "escape", "p.annostore");
    assert.throws(
      () => openStore(storePath, { workspaceRoot: ws }),
      AnnoStorePathError,
      "a store path that resolves outside the workspace root once symlinks are followed must be refused, in the ViceError family",
    );

    // THE HALF THAT MATTERS MORE THAN THE CLASS. The verifier's finding was not
    // "no error was thrown" -- it was "the store file was CREATED outside the
    // workspace root". A fix that threw but still touched the filesystem would
    // satisfy the assertion above and leave the reported defect in place, so
    // the file itself is what is asserted here.
    assert.deepEqual(
      readdirSync(outside),
      [],
      "the refusal must happen BEFORE anything is opened: the directory outside the workspace root must be untouched, not merely un-errored",
    );
    assert.equal(
      existsSync(join(outside, "p.annostore")),
      false,
      "the reproduced defect was a store file created outside the workspace root -- this is the assertion that would have caught it",
    );
  });
});

test("2. a symlink pointing INSIDE the workspace is FOLLOWED, and the store lands at the link's real path", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const real = join(ws, "real");
    mkdirSync(ws);
    mkdirSync(real);
    symlinkSync(real, join(ws, "link"), "dir");

    // THIS TEST IS WHAT MAKES TEST 1 MEANINGFUL. The easy wrong fix -- refuse
    // any path containing a symlink -- passes test 1 and fails here. A
    // confinement control that only ever refuses is indistinguishable from one
    // that works, so the discriminating case is pinned beside the refusal
    // rather than left to a reviewer's judgement.
    const handle = openStore(join(ws, "link", "p.annostore"), { workspaceRoot: ws });
    try {
      assert.equal(
        handle.path,
        join(real, "p.annostore"),
        "the handle's path is the REAL location under the workspace, not the path as written through the link -- that is what makes the confinement comparison honest",
      );
      assert.equal(existsSync(join(real, "p.annostore")), true, "and the file is actually there");
    } finally {
      closeStore(handle);
    }
  });
});

test("3. a store file that does not exist yet still opens -- the deepest-existing-ancestor walk's whole purpose", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);
    const storePath = join(ws, "fresh.annostore");
    assert.equal(existsSync(storePath), false, "precondition: the store file does not exist -- this is the COMMON case, not an edge one");

    // A bare `realpathSync(storePath)` would throw ENOENT here, on the ordinary
    // first-open path. The walk stops at `ws`, resolves that, and re-joins the
    // tail.
    const handle = openStore(storePath, { workspaceRoot: ws });
    try {
      assert.equal(handle.path, storePath, "a not-yet-created store resolves to itself under a real workspace root");
    } finally {
      closeStore(handle);
    }
    assert.equal(existsSync(storePath), true, "and the first open created it");
  });
});

test("4. a workspace root that does not exist still refuses with AnnoStorePathError, never a raw ENOENT", () => {
  inTempDir((root) => {
    const missingRoot = join(root, "nested");
    assert.equal(existsSync(missingRoot), false, "precondition: the workspace root is never created");

    // THE REGRESSION A NAIVE ROOT `realpathSync` INTRODUCES, pinned. The
    // authoritative pin lives in `anno-store.test.ts` ("a store path resolving
    // outside the supplied workspace root is refused with AnnoStorePathError"),
    // whose workspace root `<dir>/nested` is likewise never created; resolving
    // the root without the deepest-existing-ancestor walk turns that clean
    // named refusal into a bare `Error: ENOENT` and breaks a verified test.
    // Asserted here too because the reason is local to this module's fix.
    assert.throws(
      () => storePathWithinWorkspace(join(root, "escaped.annostore"), missingRoot),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStorePathError, "a non-existent workspace root must produce a NAMED family refusal, not a raw ENOENT escaping the ViceError family");
        return true;
      },
    );
  });
});

test("5. the `..` and sibling-prefix halves still refuse -- a locality restatement of the authoritative pin", () => {
  inTempDir((root) => {
    // `anno-store.test.ts`'s confinement test is the AUTHORITATIVE pin for both
    // of these, is deliberately not edited by this change, and is run as a
    // regression alongside this file. This is a convenience copy so the whole
    // confinement control set reads as one thing; it asserts the same classes
    // rather than a weaker property.
    const inside = join(root, "nested");
    assert.throws(
      () => storePathWithinWorkspace(join(root, "..", "escaped.annostore"), inside),
      AnnoStorePathError,
      "`..` traversal out of the workspace root is refused",
    );
    assert.throws(
      () => storePathWithinWorkspace(`${inside}-sibling/proj.annostore`, inside),
      AnnoStorePathError,
      "boundary safety: a SIBLING whose name merely starts with the root's name is outside it, and must not be accepted by bare string prefix",
    );
  });
});

test("6. a symlinked workspace ROOT does not make every path look foreign", () => {
  inTempDir((root) => {
    const realWs = join(root, "realws");
    mkdirSync(realWs);
    const linkWs = join(root, "linkws");
    symlinkSync(realWs, linkWs, "dir");

    // THE CASE THAT BREAKS WHEN ONLY ONE SIDE IS RESOLVED. Resolve the path but
    // not the root and this legitimate pairing is refused, because the real
    // path never starts with the link's name -- which on hosts whose temp
    // directory is itself a link would be every path.
    const handle = openStore(join(realWs, "p.annostore"), { workspaceRoot: linkWs });
    try {
      assert.equal(handle.path, join(realWs, "p.annostore"), "a path under the root's REAL location is inside a root reached through a symlink");
    } finally {
      closeStore(handle);
    }
  });
});

test("7. a DANGLING leaf symlink pointing outside the workspace is REFUSED, and nothing is created outside the root", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);

    // THE PLANT IS RELATIVE ON PURPOSE. `../outside/p.annostore` is the common
    // form a link is written in, and resolving it against the PROCESS CWD
    // instead of against the link's own directory is the one detail a naive
    // `readlinkSync` fix gets wrong. Written absolute, this test would pass
    // against that wrong fix; written relative, it does not.
    symlinkSync(join("..", "outside", "p.annostore"), join(ws, "p.annostore"));

    // NON-VACUITY PIN. A LIVE target would make this the already-passing case 1
    // (28-09 fixed live links); the whole of CR-04 is the class of name whose
    // ENTRY exists while its target does not, so the absence is the fixture.
    assert.equal(
      existsSync(join(outside, "p.annostore")),
      false,
      "precondition: the link's target must NOT exist -- a live target turns this into test 1 and the dangling bypass would go unmeasured",
    );

    const storePath = join(ws, "p.annostore");
    assert.throws(
      () => openStore(storePath, { workspaceRoot: ws }),
      AnnoStorePathError,
      "a DANGLING symlink whose target is outside the workspace root must be refused: `existsSync` reports false for it, so the old walk " +
        "stepped straight PAST the link instead of stopping at it -- the verifier observed `A) confinement ACCEPTED`",
    );

    // THE HALF THE FINDING ACTUALLY WAS, in test 1's two-part shape. The
    // verifier's line was `A) file created OUTSIDE workspace: true`: the
    // confinement returned an in-workspace path while the store file landed
    // outside the root. A fix that threw but still touched the filesystem would
    // satisfy the class assertion above and leave the reported defect in place.
    assert.deepEqual(
      readdirSync(outside),
      [],
      "the refusal must happen BEFORE anything is opened: the directory outside the workspace root must be untouched",
    );
    assert.equal(
      existsSync(join(outside, "p.annostore")),
      false,
      "the reproduced defect was a store file created outside the workspace root THROUGH a dangling link -- this is the assertion that catches it",
    );
  });
});

test("9. a dangling link pointing INSIDE the workspace is still FOLLOWED -- the over-refusal control, restated for the dangling case", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);
    // Neither `<ws>/real` nor the store file under it exists: the link is
    // dangling in exactly the way test 7's is, and points INSIDE the root.
    symlinkSync(join(ws, "real", "p.annostore"), join(ws, "link"));
    assert.equal(existsSync(join(ws, "real")), false, "precondition: the link's target directory does not exist, so the link is dangling");

    // THIS IS WHAT MAKES TEST 7 MEAN ANYTHING. The easy wrong fix -- refuse
    // whenever the stopping entry is a symlink -- passes test 7 and every other
    // refusal case while proving nothing, and it also refuses legitimate
    // layouts. Test 2 pins this for the LIVE case; the dangling case needs its
    // own control because the code path that handles it is a different one.
    //
    // TWO ASSERTIONS, AND THEY REDDEN AGAINST DIFFERENT WRONG IMPLEMENTATIONS,
    // which is why neither is folded into the other:
    //
    //   * NOT REFUSED. This is the over-refusal control proper. It holds against
    //     the pre-change code (which stepped past the link entirely) and it
    //     reddens against a blanket "refuse whenever the stopping entry is a
    //     symlink" fix -- confirmed by hand against exactly that implementation.
    //   * FOLLOWED to the link's target. The pre-change code returned the LINK's
    //     own path (`.../ws/link`, observed) rather than the target's, so this
    //     half is RED before the fix too. It is the half that says the walk
    //     RESOLVES a dangling link rather than merely tolerating it: a fix that
    //     kept stepping past the link would still pass the "not refused" half
    //     while leaving the whole of CR-04 in place.
    const resolvedStore = storePathWithinWorkspace(join(ws, "link"), ws);
    assert.ok(
      resolvedStore === ws || resolvedStore.startsWith(ws + sep),
      `a dangling link pointing inside the workspace must NOT be refused and must stay inside the root -- got ${JSON.stringify(resolvedStore)}`,
    );
    assert.equal(
      resolvedStore,
      join(ws, "real", "p.annostore"),
      "a dangling link pointing inside the workspace is FOLLOWED to its target location under the root -- the refusal must discriminate, not blanket",
    );
  });
});
