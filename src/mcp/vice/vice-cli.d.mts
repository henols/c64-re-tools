// Ambient type declarations for vice-cli.mjs (plain JS -- no build step, D-03),
// so vice-cli.test.ts's static import typechecks under this package's strict
// tsconfig. Keep this in sync with vice-cli.mjs's actual exports; there is
// nothing here to compile, only shapes for `tsc --noEmit` to read. Mirrors
// test-gate.d.mts's own precedent for the same problem.
export declare const FLOOR_REFUSAL_EXIT_CODE: number;
export declare function floorMajorFromEngineRange(range: unknown): number | null;
export declare function resolveFloorMajor(manifestPath: string | URL): number | null;
export declare function meetsFloor(runningMajor: number, floorMajor: number): boolean;
export declare function brokerArgvFrom(argv: string[]): string[];
