#!/usr/bin/env node
// dxa-live.test.ts
//
// OPT-IN, MANUAL-ONLY. Drives `dxa-run.ts`'s end-to-end path against a REAL,
// locally-built vendored `dxa` binary (`vendor/dxa/dxa`) -- the one path
// this repository's automated suite (`npm run test:automated`) never
// exercises, because no CI runner has a built `dxa` (test-gate.mjs's own
// header). This file BUILDS NOTHING ITSELF: it requires the vendored binary
// to already exist (`bash vendor/dxa/build.bash build`) and skips with a
// named reason otherwise -- proving the WHOLE stack (fixture -> host-tool
// seam -> real dxa child process -> listing file -> parser -> byte-level
// code/data map) end to end, on the one path this project actually ships.
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and
// CI has no built dxa binary. SKIP_REASON is computed once, and EVERY test
// in this file passes it through node:test's own `{ skip }` option -- never
// a hand-rolled early return, which would report a false PASS rather than a
// SKIP. It is registered in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list
// -- see that file's own header) as the TENTH manual-only file, so
// `npm run test:automated` never runs it either.
//
// Opt in with:
//   VICE_LIVE_DXA=1 node --test dxa-live.test.ts
// (after `bash vendor/dxa/build.bash build` has produced vendor/dxa/dxa).
//
// The asserted numbers are MEASURED literals (fixtures/dxa/README.md
// records the exact command that produced them), not relations to whatever
// this run happens to produce -- a real regression in dxa-run.ts's window
// computation or dxa-listing.ts's classifier must fail this loudly rather
// than silently re-baseline against its own output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runDxaDisassemble, type DxaRunFn } from "./dxa-run.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DXA_BIN_PATH = join(HERE, "vendor", "dxa", "dxa");

/** Computed exactly once. Every test in this file passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return,
 * which would report a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = process.env.VICE_LIVE_DXA !== "1"
  ? `dxa-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_DXA=1 to run it (requires a locally ` +
    `built vendored dxa binary; run "bash vendor/dxa/build.bash build" first).`
  : !existsSync(DXA_BIN_PATH)
    ? `VICE_LIVE_DXA=1 but the vendored dxa binary does not exist at ${DXA_BIN_PATH} -- run ` +
      `"bash vendor/dxa/build.bash build" first.`
    : false;

test(
  "dxa-live END TO END: runDxaDisassemble against fixtures/dxa/tracer.prg produces the MEASURED byte-level code/data map",
  { skip: SKIP_REASON },
  async () => {
    // HERE (this file's own directory, src/mcp/vice/) is passed explicitly
    // as repoRoot -- the fixture and the vendored binary both live directly
    // under it. The DEFAULT ladder dxa-run.ts/host-tool-client.ts fall back
    // to (repoRoot({ from: HERE }), repo-root.ts) walks up to the whole git
    // checkout's top level, which is the right default for a CONSUMING
    // project but not for this repository's own fixtures.
    const root = HERE;
    const listingPath = join(root, "fixtures", "dxa", "tracer.dxa-dump.lst");
    try {
      const result = await runDxaDisassemble(
        { image: "fixtures/dxa/tracer.prg", imageKind: "prg", entrypointsPath: "fixtures/dxa/tracer.entrypoints" },
        { repoRoot: root },
      );

      // The four MEASURED literals (fixtures/dxa/README.md's own recorded
      // provenance), asserted directly -- never as a relation to the run's
      // own output.
      assert.equal(result.map.covered.size, 21, "accounted byte total over the window $0801-$0815");
      assert.equal(result.map.codeBytes, 6, "code bytes, $0810-$0815");
      assert.equal(result.map.dataBytes, 15, "data bytes, $0801-$080f");
      assert.equal(result.map.matchedLines, 8, "byte-emitting matched lines");
      assert.deepEqual(result.outOfWindow, [], "zero out-of-window lines for this fixture");
      assert.equal(result.map.firstAddress, 0x0801);
      assert.equal(result.map.lastAddress, 0x0815);
      assert.equal(result.byteLength > 0, true, "the listing file must be non-empty");
      assert.match(result.sha256, /^[0-9a-f]{64}$/, "the listing digest must be a well-formed sha256");
    } finally {
      // The seam writes a real listing file next to the fixture -- clean it
      // up so a live-test run never leaves an untracked file behind.
      rmSync(listingPath, { force: true });
    }
  },
);

// Phase 35, plan 35-04 (DXA-03): the exclusion case. This pair was run
// against the pinned vendored binary this session (fixtures/dxa/README.md
// records the exact commands and both measured splits) -- the numbers below
// are MEASURED literals, not predictions.
test(
  "dxa-live EXCLUSION: a known-data range for $0810-$0815 removes those bytes from dxa's own code classification",
  { skip: SKIP_REASON },
  async () => {
    const root = HERE;
    const listingPath = join(root, "fixtures", "dxa", "tracer.dxa-dump.lst");
    const blocksPath = join(root, "fixtures", "dxa", "tracer.dxa-blocks.txt");
    try {
      // Half one: the SAME tracer run as the end-to-end case above, no
      // known-data range -- dxa's default heuristics classify $0810-$0815
      // (the entry point's own three-instruction body) as code.
      const withoutRange = await runDxaDisassemble(
        { image: "fixtures/dxa/tracer.prg", imageKind: "prg", entrypointsPath: "fixtures/dxa/tracer.entrypoints" },
        { repoRoot: root },
      );
      assert.equal(withoutRange.map.codeBytes, 6, "without a known-data range, dxa classifies $0810-$0815 as code");
      assert.equal(withoutRange.map.dataBytes, 15, "without a known-data range, data bytes are $0801-$080f");

      // Half two: the IDENTICAL run, with ONE known-data range covering the
      // SAME six bytes -- the assertion reads dxa's own classification of
      // those bytes in its listing, never the emitted -B file's contents.
      const withRange = await runDxaDisassemble(
        {
          image: "fixtures/dxa/tracer.prg",
          imageKind: "prg",
          entrypointsPath: "fixtures/dxa/tracer.entrypoints",
          knownDataRows: [{ start: 0x0810, endInclusive: 0x0815, dataType: "byte" }],
        },
        { repoRoot: root },
      );
      assert.equal(withRange.map.codeBytes, 0, "the named range's six bytes no longer classify as code");
      assert.equal(withRange.map.dataBytes, 21, "all 21 accounted bytes now classify as data");
    } finally {
      rmSync(listingPath, { force: true });
      rmSync(blocksPath, { force: true });
    }
  },
);

// Phase 35, plan 35-04 (DXA-03): the zero-range omission case. Fully
// hermetic (an injected `run` capturing the constructed wire request, never
// a real dxa process) but kept in THIS file per plan 35-04's own file scope
// -- still gated behind SKIP_REASON, following this file's own header rule
// that EVERY test here passes through node:test's `{ skip }` option.
test(
  "dxa-live OMISSION: a zero-range knownDataRows omits datablocksPath/labelsPath from the constructed request entirely",
  { skip: SKIP_REASON },
  async () => {
    let capturedArgs: Record<string, unknown> | undefined;
    const run: DxaRunFn = async (_tool, args) => {
      capturedArgs = args;
      return {
        ok: true,
        tool: "dxa.disassemble",
        exitStatus: 0,
        results: [{ path: join(HERE, "fixtures", "dxa", "tracer.dxa-dump.lst"), sha256: "0".repeat(64), byteLength: 1 }],
        stderrTail: "",
      };
    };

    await runDxaDisassemble(
      { image: "fixtures/dxa/tracer.prg", imageKind: "prg", knownDataRows: [] },
      // A synthetic 3-byte "image" (load address + one body byte, the
      // smallest parsePrg() accepts) paired with a hand-built one-line
      // listing satisfying that exact one-byte window -- this case is about
      // the CONSTRUCTED REQUEST, never about the parsed map, so no real
      // fixture bytes are needed here.
      { repoRoot: HERE, run, imageBytes: new Uint8Array([0x01, 0x08, 0x00]), listingText: "0801 00 \t.byt $00\n" },
    );

    assert.ok(capturedArgs !== undefined, "the injected run() must have been called");
    assert.equal("datablocksPath" in (capturedArgs as Record<string, unknown>), false, "zero ranges omits datablocksPath entirely");
    assert.equal("labelsPath" in (capturedArgs as Record<string, unknown>), false, "zero labels omits labelsPath entirely");
  },
);
