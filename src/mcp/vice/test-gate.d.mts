// Ambient type declarations for test-gate.mjs (plain JS -- no build step),
// so test-gate.test.ts's static import typechecks under this package's
// strict tsconfig. Keep this in sync with test-gate.mjs's actual exports;
// there is nothing here to compile, only shapes for `tsc --noEmit` to read.
export declare const MANUAL_ONLY_TESTS: readonly string[];
export declare function automatedTestFiles(dir: string): string[];
