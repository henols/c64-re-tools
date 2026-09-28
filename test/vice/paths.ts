// paths.ts
//
// WHY THIS FILE EXISTS: the one place the server tests name the package
// directory and the repository root. The tests live in test/vice/ and the
// @henols/vice-mcp package lives in src/mcp/vice/.
//
// WHAT NOT TO DO:
//   - Never rebuild these paths in a test with "..", "..", ".." joins.
//   - Never point VICE_DIR at test/vice/: a scan of "the package" must see
//     production modules only.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** test/vice/, where the server tests and their fixtures live. */
export const TEST_VICE_DIR = dirname(fileURLToPath(import.meta.url));

/** The repository root. */
export const REPO_ROOT = join(TEST_VICE_DIR, "..", "..");

/** src/mcp/vice/, the @henols/vice-mcp package directory. */
export const VICE_DIR = join(REPO_ROOT, "src", "mcp", "vice");
