#!/usr/bin/env node
// anno-schema-v2-fixture.mjs -- the TEST-ONLY child process that writes a
// GENUINE `SCHEMA_VERSION` 2 annotation store, so D-15's refusal is measured
// against a real old-format file rather than against a current store with one
// integer changed by hand.
//
// ---------------------------------------------------------------------------
// THIS MODULE IS TEST-ONLY
// ---------------------------------------------------------------------------
// Same clause, and the same three reasons, as `anno-durability-mutator.mjs`:
//
//   * It must NEVER appear in `package.json`'s `files[]`. A test-only helper
//     has no business in the published npm tarball, and `anno-seam.test.ts`'s
//     files[]-versus-disk assertion reddens on a listed `anno-*` helper.
//   * It must NEVER be imported by a production module.
//   * Its own filename deliberately does NOT match the `*.test.*` glob
//     `node --test` collects.
//
// ---------------------------------------------------------------------------
// WHY IT IS A SEPARATE PROCESS AT ALL, WHICH IS THE ONLY INTERESTING QUESTION
// ---------------------------------------------------------------------------
// `STORE-07` confines `node:sqlite` to `anno-store.ts`, and `anno-seam.test.ts`
// bounds the TEST tree with the same predicate: the set of test files naming
// the builtin is a DECLARED list, today exactly `["anno-seam.test.ts"]`. A
// fixture builder written inline in `anno-store.test.ts` would have to name the
// specifier and would therefore have to widen that declared list -- weakening a
// standing guard to serve one fixture.
//
// It goes in a spawned child instead, which is the pattern the store's own test
// tree already uses. The child names the builtin; no test file does. Widening
// the declared list would still be an available option, but it is the one that
// costs a guard, so it is not the one taken.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT DO
// ---------------------------------------------------------------------------
// It does not know the version 2 DDL. The DDL arrives as `argv[3]` from
// `anno-store.test.ts`, where it is a frozen, hand-written literal that must
// never be re-derived from the live `DDL` export -- a fixture that tracked
// today's schema would stop being version 2 the moment version 4 arrived. This
// file is a writer, not a second home for the shape.
//
// Usage: node anno-schema-v2-fixture.mjs <store-path> <version-2-ddl>
import { DatabaseSync } from "node:sqlite";

const path = process.argv[2];
const ddl = process.argv[3];

if (typeof path !== "string" || path.length === 0) {
  process.stderr.write("anno-schema-v2-fixture: argv[2] must be a store path\n");
  process.exit(2);
}
if (typeof ddl !== "string" || ddl.length === 0) {
  process.stderr.write("anno-schema-v2-fixture: argv[3] must be the version 2 DDL\n");
  process.exit(2);
}

const db = new DatabaseSync(path);
db.exec(ddl);
// THE LITERAL 2, NOT AN IMPORT OF `SCHEMA_VERSION`. Importing the constant
// would make this fixture write whatever the CURRENT version is, and the test
// it feeds would then pass by never producing a mismatch at all.
db.prepare("insert into anno_meta(id, schema_version, revision) values (1, 2, 0)").run();
db.close();
