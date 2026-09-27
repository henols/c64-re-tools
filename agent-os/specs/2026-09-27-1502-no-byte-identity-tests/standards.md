# Standards for Removing the Byte-Identity Tests

The following standards apply to this work.

---

## broker/host-bound-modules

Changes. The CI regenerate-and-diff step catches a stale `resources/*.mjs`
or entry artifact, not `resources-sync.test.ts` or `entry-sync.test.ts`.
You must still run `node build.ts` after an edit and commit the output.

---

## skills/cross-package-reach

Changes. The `sibling.ts` copies stay identical by hand. No test compares
them.

---

## global/module-header

Applies to every test file whose header names a removed test. The header
must describe what the file checks after the removal.
