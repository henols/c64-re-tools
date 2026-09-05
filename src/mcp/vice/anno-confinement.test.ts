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
// indistinguishable from one that works. Test 9 is the same control for the
// DANGLING case, and it was confirmed by hand to redden against a deliberately
// over-broad implementation (refuse whenever the stopping entry is a symlink),
// which reddens 2, 6 and 9 while leaving 1 and 7 green -- so it is a control
// that can actually go red rather than one that cannot.
//
// AND THE SIX LIVE-LINK CASES ARE GREEN OVER A REAL BYPASS -- that is why tests
// 7 through 12 exist. `28-VERIFICATION.md` gap 2 / `28-REVIEW.md` CR-04: all six
// original cases plant LIVE links, and `existsSync` reports `false` for a
// DANGLING one, so the ancestor walk stepped straight PAST it. Reproduced
// verbatim against `a8187d2`: `A) confinement ACCEPTED, returned:
// /tmp/annosym-XXXX/ws/p.annostore` with `A) file created OUTSIDE workspace:
// true`, and at the predicate `B dangling dir -> ACCEPTED`. A dangling link is a
// one-line plant needing no privilege and nothing pre-existing -- strictly
// easier than the live link the six cases do catch. Tests 1 through 6 are NOT
// edited by that addition: they are the untouched regression surface that proves
// the new walk did not trade one class of escape for another.
//
// SYMLINK SUPPORT IS ASSUMED, DELIBERATELY, AND MUST FAIL LOUDLY. The host's
// `/tmp` here is a tmpfs and supports symlinks. On a filesystem that did not,
// tests 1, 2 and 6 -- and 7 through 10, which plant dangling links and a cycle --
// would be vacuous, so `symlinkSync` is called bare: if it throws, the test
// FAILS rather than skipping. A silently skipped confinement control is exactly
// the state CR-03 was reported from.
//
// THE TEMP ROOT IS REALPATH'D BEFORE USE. `mkdtempSync(join(tmpdir(), ...))`
// can sit under a symlinked `tmpdir()` on some hosts (macOS `/var` ->
// `/private/var`). Resolving it once in the helper keeps tests 1-5 and 7-12
// asserting what they mean to assert; test 6 plants its OWN symlinked root on
// purpose.
//
// TWO RESIDUALS ARE STATED HERE AND CLOSED BY NOTHING BELOW. They are recorded
// where the guarantee is claimed, so the next reader of this file finds the limit
// beside the control rather than only in a plan document.
//
//   (a) THE CHECK-THEN-OPEN WINDOW. The confinement decision and the file
//       creation are two separate filesystem operations. A link planted BETWEEN
//       them redirects the write, and every refusal test below would still pass.
//       There is no honest fix at this layer: `node:sqlite`'s `DatabaseSync`
//       constructor takes a PATH, not a file descriptor, so there is no
//       `O_NOFOLLOW`/`openat` route to making the check and the open one
//       operation. This is a stated limit, never a handled case, and no test
//       here may be read as covering it.
//   (b) THE COMPARISON IS BYTE-WISE AND NORMALISES NOTHING. `storePathWithinWorkspace`
//       compares resolved path STRINGS with the platform separator appended, and
//       applies no Unicode normalisation. Two paths differing only in
//       normalisation form are therefore two distinct paths here, and a
//       filesystem that normalises on its own may accept a path this check
//       computed differently. Normalising here would introduce a second truth
//       that disagrees with whatever the filesystem does, so the divergence is
//       recorded rather than papered over.
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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { closeStore, openStore } from "./anno-store.ts";
import { AnnoStorePathError, storePathWithinWorkspace, workspaceRelativePath } from "./anno-types.ts";
import { runAnnoTool } from "./anno-tools.ts";
import { ViceError } from "./vice.ts";

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

test("8. a DANGLING directory symlink pointing outside the workspace is REFUSED at the predicate, and nothing is created outside the root", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);
    const outside = join(root, "outside");
    // The DIRECTORY link is dangling because its target directory is never
    // created. The store path then has a tail BELOW the link, which is what
    // makes this a different case from test 7's leaf: the hop must consume the
    // link's own name while leaving `q.annostore` hanging below whatever the
    // link resolves to.
    symlinkSync(outside, join(ws, "escape"), "dir");
    assert.equal(existsSync(outside), false, "precondition: the link's target directory does not exist -- that is what makes the link dangling");

    const storePath = join(ws, "escape", "q.annostore");

    // THE PREDICATE-LEVEL ASSERTION IS THE LOAD-BEARING ONE HERE, and the
    // reason is specific rather than stylistic. `28-VERIFICATION.md` records
    // that driving `openStore` for THIS case yields `AnnoStorePathError` for an
    // UNRELATED reason -- `DatabaseSync` cannot create a file under a
    // non-existent directory, and 28-08's wrapper converts that failure into a
    // path error. So an `openStore`-only version of this test would have passed
    // today, against the broken predicate, for the wrong reason, and case B
    // would still be open. The verifier measured it where it lives:
    // `B dangling dir -> ACCEPTED: /tmp/annosym2-XXXX/ws/sub/q.annostore`.
    assert.throws(
      () => storePathWithinWorkspace(storePath, ws),
      AnnoStorePathError,
      "the CONFINEMENT ITSELF must refuse a path whose dangling DIRECTORY link resolves outside the root -- not merely fail later for an incidental reason",
    );

    // The end-to-end half, in test 1's two-part shape. It is included for
    // completeness and for the nothing-created assertion; it is NOT the half
    // that carries the finding (see above).
    assert.throws(() => openStore(storePath, { workspaceRoot: ws }), AnnoStorePathError);
    assert.equal(
      existsSync(outside),
      false,
      "nothing outside the workspace root may be created -- not the target directory, and not a store file inside it",
    );
  });
});

test("10. a symlink CYCLE refuses with AnnoStorePathError naming the hop bound, rather than looping", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);
    // `a -> b` and `b -> a`. Both are dangling in the sense the walk cares
    // about: `existsSync` on either gets `ELOOP` from the kernel and reports
    // false, so each is a stopping ENTRY whose target does not resolve, and the
    // hop moves between them forever unless something bounds it.
    symlinkSync(join(ws, "b"), join(ws, "a"));
    symlinkSync(join(ws, "a"), join(ws, "b"));

    // THE FAILURE MODE OF A REGRESSION HERE IS A TIMEOUT, NOT AN ASSERTION.
    // Remove the hop counter and this call never returns, so the elapsed
    // assertion below never runs and the test runner reports the file as timed
    // out. A reader looking at a red run should expect that shape rather than a
    // diff. The wall-clock bound is what turns a hang into a reported failure.
    const startedAt = Date.now();
    assert.throws(
      () => storePathWithinWorkspace(join(ws, "a"), ws),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStorePathError, "a cycle must refuse inside the ViceError family, not escape as a bare Error or an ELOOP");
        assert.match(
          (e as Error).message,
          /40/,
          "the refusal must NAME the hop bound, so a caller can tell a cycle from an ordinary outside-the-root refusal",
        );
        return true;
      },
    );
    assert.ok(Date.now() - startedAt < 2000, "the refusal must be prompt: an unbounded hop is a hang, and a hang in a confinement check is a denial of service on unvalidated input");
  });
});

test("11. the boundary, one step either side: the root itself, one segment in, one segment out, and the sibling-prefix", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);

    // ACCEPTED: the workspace root ITSELF as the store path. This is the
    // `resolvedPath !== resolvedRoot` arm; drop it and this case reddens.
    assert.equal(
      storePathWithinWorkspace(ws, ws),
      ws,
      "the workspace root itself is inside the workspace root -- the boundary is inclusive, and the returned value is the resolved root",
    );

    // ACCEPTED: one segment beneath the root.
    assert.equal(
      storePathWithinWorkspace(join(ws, "p.annostore"), ws),
      join(ws, "p.annostore"),
      "one segment beneath the root is inside it",
    );

    // REFUSED: one segment ABOVE the root. `anno-store.test.ts` and test 5 are
    // the AUTHORITATIVE pins for both of the refusals below; this is the same
    // locality restatement test 5 already declares itself to be, asserting the
    // same classes one step either side of the boundary rather than a weaker
    // property.
    assert.throws(
      () => storePathWithinWorkspace(join(ws, ".."), ws),
      AnnoStorePathError,
      "one segment ABOVE the root is outside it",
    );

    // REFUSED: a sibling whose name merely STARTS with the root's name.
    // Replacing the separator-appended comparison with a bare `startsWith`
    // reddens exactly this case and nothing else.
    assert.throws(
      () => storePathWithinWorkspace(join(root, "wsx", "proj.annostore"), ws),
      AnnoStorePathError,
      "boundary safety: `<parent>/wsx` is not inside `<parent>/ws`, and only the separator-appended comparison can tell",
    );
  });
});

test("12. idempotency: a repeated confinement check returns the identical answer and creates nothing", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);
    // Test 7's plant, reused as the REJECTED input.
    symlinkSync(join("..", "outside", "p.annostore"), join(ws, "dangling"));

    const accepted = join(ws, "p.annostore");
    const before = readdirSync(ws).sort();

    const first = storePathWithinWorkspace(accepted, ws);
    const second = storePathWithinWorkspace(accepted, ws);
    assert.equal(first, second, "two calls on the same accepted input return the byte-identical string -- the check is a question, not a step");

    assert.throws(() => storePathWithinWorkspace(join(ws, "dangling"), ws), AnnoStorePathError, "first call on the rejected input refuses");
    assert.throws(() => storePathWithinWorkspace(join(ws, "dangling"), ws), AnnoStorePathError, "and so does the second -- a refusal is not consumed by being observed");

    // THE NON-VACUITY HALF. Any implementation that memoises, that creates a
    // directory so the walk resolves, or that mutates module state to
    // short-circuit the second call fails one of these three assertions. The
    // check must CREATE NOTHING -- that is what makes a repeated call the same
    // answer rather than a second, different one.
    assert.deepEqual(readdirSync(ws).sort(), before, "the workspace listing is unchanged across all four calls: the confinement check creates nothing");
    assert.deepEqual(readdirSync(outside), [], "and nothing appeared outside the root either");
  });
});

// CASES 13, 14 AND 15 -- `WR-12`, the three input classes the twelve cases
// above have never planted. `28-VERIFICATION.md` records them as COINCIDENTAL
// RELIANCE: the confinement OUTCOME on these inputs was already right, but it
// was right because an unhandled OS error aborted the call, not because
// anything decided. 28-12 swapped `existsSync` for `lstatSync` in the ancestor
// walk; `throwIfNoEntry: false` suppresses ENOENT ONLY, so all three escaped
// `openStore` as bare `Error`s outside the `ViceError` family. Measured against
// the pre-plan tree at `49826f9`, at BOTH entry points, on this host
// (Node 22.22):
//
//   A predicate (ENOTDIR): threw Error | inViceFamily=false | ENOTDIR: not a directory, lstat '.../wsA/notes.txt/p.annostore'
//   A openStore   (ENOTDIR): threw Error | inViceFamily=false | ENOTDIR: not a directory, lstat '.../wsA/notes.txt/p.annostore'
//   B predicate (EACCES): threw Error | inViceFamily=false | EACCES: permission denied, lstat '.../wsB/locked/p.annostore'
//   B openStore   (EACCES): threw Error | inViceFamily=false | EACCES: permission denied, lstat '.../wsB/locked/p.annostore'
//   C predicate (ancestor ELOOP): threw Error | inViceFamily=false | ELOOP: too many symbolic links encountered, lstat '.../wsC/a/sub/p.annostore'
//   C openStore   (ancestor ELOOP): threw Error | inViceFamily=false | ELOOP: too many symbolic links encountered, lstat '.../wsC/a/sub/p.annostore'
//
// EACH IS DRIVEN THROUGH BOTH ENTRY POINTS ON PURPOSE. Case 8 above records why
// a predicate-only assertion can pass for the wrong reason; the mirror hazard is
// an `openStore`-only assertion passing because `DatabaseSync` happened to fail
// downstream. Asserting both is what makes the refusal a decision of the
// confinement rather than a coincidence of whatever runs next.

test("13. an ancestor that is a REGULAR FILE is refused with AnnoStorePathError at both entry points, and the file is left untouched", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);

    // THE PLANT NEEDS NO SYMLINK, NO PRIVILEGE AND NOTHING PRE-EXISTING -- it is
    // an ordinary caller typo (`notes.txt` where a directory was meant), which
    // is what makes this the most reachable of the three classes rather than an
    // exotic one.
    const notes = join(ws, "notes.txt");
    writeFileSync(notes, "original contents");
    const storePath = join(ws, "notes.txt", "p.annostore");
    const wsBefore = readdirSync(ws).sort();

    for (const [label, call] of [
      ["storePathWithinWorkspace", () => storePathWithinWorkspace(storePath, ws)],
      ["openStore", () => openStore(storePath, { workspaceRoot: ws })],
    ] as const) {
      assert.throws(
        call,
        (e: unknown) => {
          assert.ok(
            e instanceof AnnoStorePathError,
            `${label}: a regular-file ancestor must refuse by NAME -- before this plan it aborted with a bare ENOTDIR Error`,
          );
          assert.ok(
            e instanceof ViceError,
            `${label}: and the refusal must be inside the ViceError family -- \`inViceFamily=false\` is the measured defect`,
          );
          assert.ok(
            (e as Error).message.includes(storePath),
            `${label}: the refusal must NAME the path the caller asked about -- got ${JSON.stringify((e as Error).message)}`,
          );
          return true;
        },
      );
    }

    // THE REFUSAL MUST NOT HAVE TOUCHED THE FILE. A "fix" that created a
    // directory where the file was, or truncated it on the way to opening a
    // store under it, would satisfy every class assertion above and destroy the
    // caller's data.
    assert.equal(statSync(notes).isFile(), true, "the ancestor is still a REGULAR FILE -- the refusal must not have replaced it with a directory");
    assert.equal(readFileSync(notes, "utf8"), "original contents", "and its contents are byte-identical -- nothing truncated it on the way to a refusal");
    assert.deepEqual(readdirSync(ws).sort(), wsBefore, "the workspace listing is unchanged: the confinement check creates nothing");
    assert.deepEqual(readdirSync(outside), [], "and nothing appeared outside the root either");
  });
});

test(
  "14. an UNREADABLE ancestor directory is refused with AnnoStorePathError at both entry points",
  {
    // ROOT CANNOT CONSTRUCT THIS FIXTURE. Root ignores directory mode bits, so
    // `lstat` under a `0o000` directory SUCCEEDS and the EACCES this case is
    // about never happens -- the case would pass while measuring nothing. A
    // silently-passing confinement control is precisely the blind spot this
    // task exists to remove, so the skip is explicit and carries its reason.
    skip:
      process.getuid?.() === 0
        ? "running as root: root ignores directory mode bits, so a 0o000 ancestor still stats successfully and the EACCES class cannot be planted -- this case would pass vacuously"
        : false,
  },
  () => {
    inTempDir((root) => {
      const ws = join(root, "ws");
      const outside = join(root, "outside");
      mkdirSync(ws);
      mkdirSync(outside);

      const locked = join(ws, "locked");
      mkdirSync(locked);
      const storePath = join(locked, "p.annostore");

      // UNCONDITIONAL RESTORE. `inTempDir`'s `finally rmSync` cannot recurse
      // into a `0o000` directory, and `/tmp` here is a tmpfs whose periodic
      // cleanup is disabled -- a leaked fixture is leaked RAM until reboot.
      chmodSync(locked, 0o000);
      try {
        // NON-VACUITY PIN. If the mode change did not actually make the child
        // unreadable on this filesystem, the case is measuring nothing.
        assert.throws(() => statSync(storePath), /EACCES/, "precondition: stat of a child of the locked directory must fail with EACCES, or this case measures nothing");

        for (const [label, call] of [
          ["storePathWithinWorkspace", () => storePathWithinWorkspace(storePath, ws)],
          ["openStore", () => openStore(storePath, { workspaceRoot: ws })],
        ] as const) {
          assert.throws(
            call,
            (e: unknown) => {
              assert.ok(
                e instanceof AnnoStorePathError,
                `${label}: an unreadable ancestor must refuse by NAME -- before this plan it aborted with a bare EACCES Error`,
              );
              assert.ok(e instanceof ViceError, `${label}: and the refusal must be inside the ViceError family`);
              assert.ok(
                (e as Error).message.includes(storePath),
                `${label}: the refusal must NAME the path the caller asked about -- got ${JSON.stringify((e as Error).message)}`,
              );
              return true;
            },
          );
        }
      } finally {
        chmodSync(locked, 0o755);
      }

      assert.deepEqual(readdirSync(locked), [], "no store file was created under the unreadable ancestor");
      assert.deepEqual(readdirSync(outside), [], "and nothing appeared outside the root either");
    });
  },
);

test("15. a symlink cycle in an ANCESTOR position is refused with AnnoStorePathError at both entry points -- and it is the KERNEL's bound, not the manual hop counter, that refuses it", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);

    // Case 10's plant, asked for in the OTHER spelling. `a -> b`, `b -> a`.
    symlinkSync(join(ws, "b"), join(ws, "a"));
    symlinkSync(join(ws, "a"), join(ws, "b"));

    // CASE 10 PINS THE LEAF SPELLING (`<ws>/a`); THIS CASE PINS THE ANCESTOR
    // SPELLING (`<ws>/a/sub/p.annostore`), AND THEY DO NOT TAKE THE SAME ROUTE.
    // 28-12's truth 3 -- "a cycle refuses with the hop bound rather than
    // looping" -- was measured only against the leaf spelling, and it is true
    // only there. MEASURED, both spellings, this host:
    //
    //   * LEAF. `lstat` does NOT follow the FINAL component, so `<ws>/a` is a
    //     stopping ENTRY, the manual hop loop runs, and `MAX_SYMLINK_HOPS`
    //     refuses. That is case 10, and its message names 40.
    //   * ANCESTOR. `lstat` MUST follow `a` to reach `sub`, so the kernel's own
    //     MAXSYMLINKS fires first and `lstat` throws ELOOP -- before the walk
    //     has descended anywhere and before the hop counter has run once. Until
    //     this plan that ELOOP escaped as a bare `Error`
    //     (`inViceFamily=false`, transcript in the block above); it is the
    //     WR-12 wrap in `pathEntryExists`, not the hop counter, that refuses it
    //     now.
    //
    // THE TWO BOUNDS AGREE BY CONSTRUCTION and that is the point rather than an
    // accident: `MAX_SYMLINK_HOPS` is 40 because Linux's MAXSYMLINKS is 40, so
    // whichever bound fires, the answer is the same refusal. The manual counter
    // is therefore UNREACHABLE in ancestor position by design, not by omission.
    const storePath = join(ws, "a", "sub", "p.annostore");
    const startedAt = Date.now();

    for (const [label, call] of [
      ["storePathWithinWorkspace", () => storePathWithinWorkspace(storePath, ws)],
      ["openStore", () => openStore(storePath, { workspaceRoot: ws })],
    ] as const) {
      assert.throws(
        call,
        (e: unknown) => {
          assert.ok(
            e instanceof AnnoStorePathError,
            `${label}: an ANCESTOR cycle must refuse by NAME -- before this plan it aborted with a bare ELOOP Error while the LEAF spelling refused correctly`,
          );
          assert.ok(e instanceof ViceError, `${label}: and the refusal must be inside the ViceError family`);
          assert.ok(
            (e as Error).message.includes(storePath),
            `${label}: the refusal must NAME the path the caller asked about -- got ${JSON.stringify((e as Error).message)}`,
          );
          assert.match(
            (e as Error).message,
            /ELOOP/,
            `${label}: and it must carry the underlying reason, which for the ANCESTOR spelling is the kernel's own ELOOP and NOT the manual hop bound`,
          );
          return true;
        },
      );
    }

    // THE COMPARISON THAT MAKES THIS CASE MORE THAN A COPY OF CASE 10. Same two
    // links, same cycle, asked for in the leaf spelling: that one DOES reach
    // the manual counter and names the bound. Asserted here beside the ancestor
    // spelling so a future reader sees the two routes in one place rather than
    // concluding from case 10 alone that "a cycle names 40".
    assert.throws(
      () => storePathWithinWorkspace(join(ws, "a"), ws),
      (e: unknown) => {
        assert.match((e as Error).message, /40/, "the LEAF spelling of the SAME cycle is refused by the manual hop counter and names the 40-hop bound");
        return true;
      },
    );

    assert.ok(Date.now() - startedAt < 2000, "the refusal must be prompt in BOTH spellings: an unbounded hop is a hang, and a hang in a confinement check is a denial of service on unvalidated input");
    assert.deepEqual(readdirSync(outside), [], "nothing was created outside the workspace root");
    assert.deepEqual(readdirSync(ws).sort(), ["a", "b"], "and nothing was created inside it either -- the confinement check creates nothing");
  });
});

// ---------------------------------------------------------------------------
// `workspaceRelativePath()` -- the control set for the OTHER seam in
// `anno-types.ts`, placed here rather than in a new file because it shares a
// root-resolution rule with `storePathWithinWorkspace()` above and the same
// symlink scaffolding is what tests that rule.
//
// WHAT IT IS FOR, so a later reader does not read it as a second confinement
// check. It computes the spelling that goes into a COMPARED artifact -- the
// memory map's banner, which `checkRenderedMemoryMap()` re-renders and diffs
// byte for byte. `CR-01` / `29-VERIFICATION.md` gap 1: the banner recorded the
// absolute realpaths, so a byte-identical store, sidecar and rendered file
// reported `drifted` the moment the checkout sat at a different absolute path,
// while the artifact's own `render_digest` printed identical in both trees.
//
// AND THE SAME DISCRIMINATION RULE APPLIES HERE. A function that refused every
// path would pass test 18's refusal half and prove nothing. Tests 16, 17 and 19
// are what make 18 meaningful: the equal case, the nested case and the
// symlinked-root case must all be ACCEPTED and spelled cleanly, and 18's own
// second half asserts that a `..` segment which normalises back INSIDE the root
// is accepted rather than refused on sight.
// ---------------------------------------------------------------------------

test("16. workspaceRelativePath: the root itself spells `.`, one segment below spells that segment, and a deep nest spells the whole path", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    mkdirSync(ws);

    // The EQUAL case yields `.` -- never an empty field and never a bare
    // separator. A banner line reading `store:` with nothing after it is not a
    // recorded location, it is a missing one.
    assert.equal(workspaceRelativePath(ws, ws), ".", "path and root resolving equal must spell `.`");

    // One segment below: the segment, with NO leading separator. A leading
    // separator would make the spelling look absolute to a reader and to any
    // later `isAbsolute()` check.
    const oneDown = join(ws, "game.annostore");
    writeFileSync(oneDown, "");
    assert.equal(workspaceRelativePath(oneDown, ws), "game.annostore");

    // Deep nesting: every segment survives, in order.
    const deep = join(ws, "a", "b", "c");
    mkdirSync(deep, { recursive: true });
    const deepStore = join(deep, "game.annostore");
    writeFileSync(deepStore, "");
    assert.equal(workspaceRelativePath(deepStore, ws), "a/b/c/game.annostore");
  });
});

test("17. workspaceRelativePath: the spelling is separator-NORMALISED to POSIX `/` -- whose definition of equality applies is settled in one place", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const deep = join(ws, "a", "b");
    mkdirSync(deep, { recursive: true });
    const store = join(deep, "game.annostore");
    writeFileSync(store, "");

    const spelling = workspaceRelativePath(store, ws);

    // This is the property that lets the SAME tree checked out on two hosts
    // with different path separators compare byte-identical: the compared bytes
    // carry one separator spelling, not the host's.
    assert.ok(!spelling.includes("\\"), `the spelling must contain no backslash, got ${JSON.stringify(spelling)}`);
    assert.ok(!/^[A-Za-z]:/.test(spelling), `the spelling must contain no drive letter, got ${JSON.stringify(spelling)}`);
    assert.deepEqual(spelling.split("/"), ["a", "b", "game.annostore"], "segments are joined by `/` and by nothing else");
    assert.ok(!spelling.startsWith("/"), "a relative spelling never starts with a separator");
  });
});

test("18. workspaceRelativePath: a path OUTSIDE the root is refused BY NAME rather than spelled with `..`, while a `..` that normalises back INSIDE is accepted", () => {
  inTempDir((root) => {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);
    const foreign = join(outside, "game.annostore");
    writeFileSync(foreign, "");

    // THE REFUSAL. Returning "../outside/game.annostore" would be the same
    // machine-dependence wearing a different spelling: the number of `..` hops
    // encodes where the checkout sits.
    let thrown: unknown;
    try {
      const spelled = workspaceRelativePath(foreign, ws);
      assert.fail(`expected a refusal, got the spelling ${JSON.stringify(spelled)}`);
    } catch (e) {
      thrown = e;
    }
    assert.ok(thrown instanceof AnnoStorePathError, `the refusal must be an AnnoStorePathError, got ${String(thrown)}`);
    assert.ok(thrown instanceof ViceError, "AnnoStorePathError stays inside the ViceError family");
    const message = (thrown as Error).message;
    assert.ok(message.includes(realpathSync(foreign)), "the refusal names the RESOLVED path");
    assert.ok(message.includes(realpathSync(ws)), "the refusal names the RESOLVED workspace root");
    assert.ok(!message.includes(".."), "the refusal must not hand back the `..` spelling it declined to return");

    // THE DISCRIMINATION. A control that refuses every `..` proves nothing --
    // it would also refuse a legitimate in-workspace path spelled with one.
    mkdirSync(join(ws, "sub"));
    const round_trip = join(ws, "sub", "..", "game.annostore");
    writeFileSync(join(ws, "game.annostore"), "");
    assert.equal(
      workspaceRelativePath(round_trip, ws),
      "game.annostore",
      "a `..` segment that normalises back inside the root is a legitimate in-workspace path and must be ACCEPTED",
    );
  });
});

test("19. workspaceRelativePath: a symlinked workspace ROOT does not make an in-workspace store look foreign -- both sides go through the one resolution", () => {
  inTempDir((root) => {
    const realWs = join(root, "realws");
    mkdirSync(realWs);
    const linkWs = join(root, "linkws");
    symlinkSync(realWs, linkWs, "dir");

    // The exact pairing the CLI produces: `repoRoot()` is not necessarily a
    // realpath, while the store path has already been through
    // `storePathWithinWorkspace()` and therefore IS one. Resolve only one side
    // and this legitimate pairing spells `../realws/game.annostore` -- machine
    // dependence back under a new spelling -- or throws outright.
    const store = join(realWs, "game.annostore");
    writeFileSync(store, "");
    assert.equal(
      workspaceRelativePath(store, linkWs),
      "game.annostore",
      "a realpath'd store under a symlinked root spells cleanly, because both sides go through realpathOfNearestExisting",
    );

    // And the mirror: the store reached THROUGH the link resolves to the same
    // spelling, so the two agree rather than disagreeing by one hop.
    assert.equal(workspaceRelativePath(join(linkWs, "game.annostore"), realWs), "game.annostore");
  });
});

// ---------------------------------------------------------------------------
// 20-21. `anno_import_ghidra_export`'s `export_path` argument (T-37-01,
// Phase 37 plan 37-01/37-02). Goes through the SAME `resolveWorkspacePath()`
// the `store` and `image` arguments already use. Unlike tests 1-19, which
// call `openStore()` directly with an explicit `workspaceRoot`, these two
// cases go through `runAnnoTool()` -- the only public entry point -- because
// `resolveWorkspacePath()` resolves against `repoRoot()`, not a caller-passed
// option. `anno-tools.test.ts`'s own header names this exactly: "THE
// WORKSPACE ROOT IS MOVED, NOT MOCKED" -- `repoRoot()`'s branch 0 reads
// `CLAUDE_PROJECT_DIR` from `process.env` on every call, so pointing that
// variable at a temp directory exercises the REAL confinement code against a
// REAL temporary workspace. A removal of the resolve call in `anno-tools.ts`'s
// dispatch arm reddens THIS file rather than only a unit test that could
// drift out of sync with the real dispatch.
// ---------------------------------------------------------------------------

test("20. anno_import_ghidra_export: an export_path resolving outside the workspace root is refused before the file is read, naming the argument", async () => {
  const root = mkdtempSync(join(tmpdir(), "anno-confine-"));
  const previous = process.env.CLAUDE_PROJECT_DIR;
  try {
    const ws = join(root, "ws");
    mkdirSync(ws);
    const storePath = join(ws, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: ws });
    closeStore(handle);

    // An ABSOLUTE outside path, mirroring `anno-tools.test.ts`'s own store-path
    // confinement case -- this sidesteps any question of what a RELATIVE
    // argument resolves against (this seam resolves it against `process.cwd()`,
    // not the workspace root, exactly as `store`/`image` already do).
    const outsideFile = join(root, "outside-export.txt");
    writeFileSync(outsideFile, "## REFERENCES\n## REFERENCE_COUNT 0\n", "utf8");

    process.env.CLAUDE_PROJECT_DIR = ws;
    const result = await runAnnoTool("anno_import_ghidra_export", { store: storePath, export_path: outsideFile });
    assert.equal(result.isError, true, "an export_path outside the workspace root must be refused, never read");
    assert.match(result.content[0]!.text, /export_path/);
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("21. anno_import_ghidra_export: a symlink inside the workspace whose target is outside it is refused by the same code path", async () => {
  const root = mkdtempSync(join(tmpdir(), "anno-confine-"));
  const previous = process.env.CLAUDE_PROJECT_DIR;
  try {
    const ws = join(root, "ws");
    const outside = join(root, "outside");
    mkdirSync(ws);
    mkdirSync(outside);
    writeFileSync(join(outside, "export.txt"), "## REFERENCES\n## REFERENCE_COUNT 0\n", "utf8");
    symlinkSync(join(outside, "export.txt"), join(ws, "escape.txt"));

    const storePath = join(ws, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: ws });
    closeStore(handle);

    process.env.CLAUDE_PROJECT_DIR = ws;
    const result = await runAnnoTool("anno_import_ghidra_export", { store: storePath, export_path: join(ws, "escape.txt") });
    assert.equal(result.isError, true, "a symlinked export_path resolving outside the workspace must be refused");
    assert.match(result.content[0]!.text, /export_path|AnnoStorePathError/);
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
