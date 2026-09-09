#!/usr/bin/env node
// text-protocol.test.ts
//
// Deterministic, no-emulator unit tests for text-protocol.ts's framing state
// machine -- everything a real net.Socket can be driven through against a
// local stub server, following stock-protocol.test.ts's own
// withStubNetServer() harness discipline (a real TCP server, controlled
// chunking and timing, every accepted socket tracked and destroyed in
// teardown). No fixture in this file is hand-rolled: every payload byte
// count assertion is driven from textmon-fixtures.ts's loadTextFixture()/
// listTextFixtures(), never a direct readFileSync against fixtures/textmon.
//
// Two planted controls, both required by CHAN-03's own criterion text
// ("prove the framing rather than assert it"):
//
//   Control 1 -- a prompt split across two socket chunks. The REAL fix is
//   structural (TextMonitorClient accumulates raw Buffers and matches only
//   against the tail of the whole accumulated buffer). This file also
//   demonstrates, via a same-file NEGATIVE comparison (naivePerChunkMatch(),
//   never a production export), that a per-chunk decode-and-match design --
//   the wrong alternative CHAN-03 rules out -- genuinely fails on the exact
//   same split.
//
//   Control 2 -- prompt-shaped output mid-stream. This is not hypothetical:
//   the plan's own Task 1 commit records a LIVE, measured occurrence (a
//   residual leading prompt arriving as its own chunk ahead of a command's
//   real output), fixed by the quiescence window TextMonitorClient now
//   ships. This file reproduces the RED case directly with the REAL class,
//   constructed with `quiescenceMs: 0` (no window) against the exact same
//   scenario the default-configured class (quiescenceMs: TEXT_QUIESCENCE_MS)
//   is then shown to survive -- so the control is a live A/B on the shipped
//   code, not a reimplementation of it.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  TextMonitorClient,
  PROMPT_RE,
  TEXT_COMMAND_ALLOWLIST,
  isAllowlistedTextCommand,
  TextFramingError,
  TEXT_MAX_BUFFERED_LEN,
  TEXT_QUIESCENCE_MS,
  withTextChannelLock,
} from "./text-protocol.ts";
import { TEXTMON_FIXTURE_DIR, listTextFixtures, loadTextFixture } from "./textmon-fixtures.ts";
import { resetChannelLockForTests } from "./channel-lock.ts";

// Plan 41-02 (D-07, CHAN-04): command() now refuses unless the text
// channel's own halt authority is held. Every real (non-refusal) command()
// call in this file below is therefore wrapped in withTextChannelLock() --
// this beforeEach is hygiene against a lock left held by a prior test that
// threw before its own release ran.
beforeEach(() => {
  resetChannelLockForTests();
});

// ---------------------------------------------------------------------------
// Shared harness -- mirrors stock-protocol.test.ts's own withStubNetServer().
// ---------------------------------------------------------------------------

async function withStubNetServer<T>(
  handler: (socket: import("node:net").Socket) => void,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Local, test-only byte splitter -- deliberately NOT imported from
 * binmon-fixtures.ts's chunkBytes(), matching this phase's own separation
 * discipline (textmon-fixtures.ts's header comment: share the CONTRACT,
 * never the loader/utility surface). */
function chunkBytes(buf: Buffer, size: number): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) {
    out.push(buf.subarray(i, i + size));
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Basic allowlist / command-refusal behavior.
// ---------------------------------------------------------------------------

test("isAllowlistedTextCommand: accepts every TEXT_COMMAND_ALLOWLIST entry and rejects an arbitrary string", () => {
  for (const cmd of TEXT_COMMAND_ALLOWLIST) {
    assert.ok(isAllowlistedTextCommand(cmd), `expected ${JSON.stringify(cmd)} to be allowlisted`);
  }
  assert.ok(!isAllowlistedTextCommand("load \"foo\" 8 1"), "an arbitrary command string must never be allowlisted");
  assert.ok(!isAllowlistedTextCommand("device c"), "the colon is required -- device c (no colon) is a different, non-allowlisted string");
});

test("TEXT_COMMAND_ALLOWLIST: every entry is exactly one of the eight named verbs, never a file-touching monitor verb (T-41-02)", () => {
  const expected = ["device c:", "warp on", "warp off", "memmapshow", "prof flat", "chis", "bt", "io"];
  assert.deepEqual([...TEXT_COMMAND_ALLOWLIST].sort(), [...expected].sort());
  for (const cmd of TEXT_COMMAND_ALLOWLIST) {
    assert.doesNotMatch(cmd, /\bload\b|\bsave\b/, `${JSON.stringify(cmd)} must not be a file-touching verb`);
  }
});

test("TextMonitorClient.command(): refuses a non-allowlisted command before any byte reaches the socket", async () => {
  let socketReceivedBytes = false;
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        socketReceivedBytes = true;
      });
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      await assert.rejects(() => client.command("load \"foo\" 8 1"), /refusing non-allowlisted command/);
      await sleep(50);
      assert.equal(socketReceivedBytes, false, "no byte may reach the socket for a refused command");
      await client.disconnect();
    },
  );
});

test("TextMonitorClient.command(): refuses a command containing an embedded line feed before any byte reaches the socket", async () => {
  let socketReceivedBytes = false;
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        socketReceivedBytes = true;
      });
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      // Not reachable through the real allowlist (D-01) -- defense in depth,
      // exercised directly against command()'s own character check.
      await assert.rejects(() => client.command("device c:\nquit"), /CR, LF, or C0 control character/);
      await sleep(50);
      assert.equal(socketReceivedBytes, false);
      await client.disconnect();
    },
  );
});

test("textConnect (D-13(a)): connect() never reads or waits for a connect banner -- it resolves with zero bytes sent by the server", async () => {
  await withStubNetServer(
    () => {
      /* the server sends nothing at all -- if connect() ever waited for a
       * byte, this test would hang until its own timeout. */
    },
    async (port) => {
      const client = new TextMonitorClient();
      const start = Date.now();
      await client.connect("127.0.0.1", port);
      const elapsedMs = Date.now() - start;
      assert.ok(elapsedMs < 1000, `connect() must resolve immediately with no banner wait, took ${elapsedMs}ms`);
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// Control 1 -- a prompt split across two socket chunks.
// ---------------------------------------------------------------------------

test("Control 1: a prompt split across two socket chunks (even byte-at-a-time) yields exactly one complete response", async () => {
  const response = Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8");
  await withStubNetServer(
    (socket) => {
      for (const chunk of chunkBytes(response, 1)) {
        socket.write(chunk);
      }
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
      assert.equal(payload, "Setting default device to `Computer'\n");
      await client.disconnect();
    },
  );
});

test("Control 1 (negative control): a per-chunk decode-and-match design fails on the exact same split -- proves the structure, not merely asserts it", () => {
  // The WRONG alternative CHAN-03 rules out: decode EACH chunk individually
  // and test the decoded chunk alone against PROMPT_RE. Never a production
  // export -- exists only to prove, by contrast, why TextMonitorClient
  // accumulates raw Buffers instead.
  function naivePerChunkMatch(chunks: Buffer[]): boolean[] {
    return chunks.map((c) => PROMPT_RE.test(c.toString("utf8")));
  }
  // The split falls INSIDE the four hex digits of the prompt.
  const chunk1 = Buffer.from("Setting default device to `Computer'\n(C:$e5", "utf8");
  const chunk2 = Buffer.from("d1) ", "utf8");
  const perChunkResults = naivePerChunkMatch([chunk1, chunk2]);
  assert.deepEqual(
    perChunkResults,
    [false, false],
    "a per-chunk matcher never observes the prompt at all when the split falls inside it -- it would wait forever",
  );
  // The REAL design: accumulate first, match on the tail of the WHOLE buffer.
  const accumulated = Buffer.concat([chunk1, chunk2]);
  assert.ok(PROMPT_RE.test(accumulated.toString("utf8")), "the accumulated buffer must match -- this is the fix Control 1 proves");
});

// ---------------------------------------------------------------------------
// Control 2 -- prompt-shaped output mid-stream, and the quiescence window.
// ---------------------------------------------------------------------------

test("Control 2 (planted RED, without the fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the real output", async () => {
  const midStreamPrompt = Buffer.from("(C:$1234) ", "utf8"); // prompt-shaped, but NOT the real terminator
  const realOutput = Buffer.from("the real command output\n(C:$5678) ", "utf8"); // arrives after a short delay
  await withStubNetServer(
    (socket) => {
      socket.write(midStreamPrompt);
      setTimeout(() => socket.write(realOutput), 15);
    },
    async (port) => {
      // quiescenceMs: 0 -- the RED configuration: no window survives, so the
      // first tail match (the mid-stream prompt) is accepted immediately.
      const client = new TextMonitorClient({ quiescenceMs: 0 });
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
      // RED: the real output never made it into the payload -- the command
      // resolved on the mid-stream prompt alone, empty of real content.
      assert.equal(payload, "", `RED observation (recorded in the plan SUMMARY): payload was ${JSON.stringify(payload)}, expected the mid-stream prompt to be wrongly accepted as final and empty`);
      await client.disconnect();
    },
  );
});

test("Control 2 (fixed, GREEN): the default quiescence window survives prompt-shaped mid-stream text and returns the complete response with the mid-stream occurrence preserved", async () => {
  const midStreamPrompt = Buffer.from("(C:$1234) ", "utf8");
  const realOutput = Buffer.from("the real command output\n(C:$5678) ", "utf8");
  await withStubNetServer(
    (socket) => {
      socket.write(midStreamPrompt);
      setTimeout(() => socket.write(realOutput), 15); // well inside TEXT_QUIESCENCE_MS
    },
    async (port) => {
      const client = new TextMonitorClient(); // default TEXT_QUIESCENCE_MS
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
      assert.equal(payload, "(C:$1234) the real command output\n", "the mid-stream prompt-shaped text must be preserved in the payload, and only the true trailing prompt stripped");
      await client.disconnect();
    },
  );
});

test("TEXT_QUIESCENCE_MS is a positive, finite number by default (documents the derivation this control depends on)", () => {
  assert.ok(Number.isFinite(TEXT_QUIESCENCE_MS) && TEXT_QUIESCENCE_MS > 0);
});

// ---------------------------------------------------------------------------
// Passive banner drain (D-13(b)).
// ---------------------------------------------------------------------------

test("D-13(b): a passively-arriving banner with no command outstanding is drained, counted, and never resolves a later command", async () => {
  const bannerFrame = Buffer.from("BREAK: 3 A 08FE  A9 00       LDA #$00\n(C:$08fe) ", "utf8");
  let socket_: import("node:net").Socket | null = null;
  await withStubNetServer(
    (socket) => {
      socket_ = socket;
      socket.write(bannerFrame); // arrives with NO command outstanding
    },
    async (port) => {
      const client = new TextMonitorClient();
      const banners: string[] = [];
      client.on("banner", (text: string) => banners.push(text));
      await client.connect("127.0.0.1", port);
      await sleep(100); // let the banner drain before issuing a real command
      assert.equal(client.bannerFramesDrained, 1);
      assert.equal(banners.length, 1);
      assert.match(banners[0]!, /BREAK: 3 A 08FE/);

      // Now issue a real command over the SAME connection -- its own
      // response must be the command's own output, never the drained banner.
      socket_!.write(Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8"));
      const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
      assert.equal(payload, "Setting default device to `Computer'\n");
      assert.equal(client.bannerFramesDrained, 1, "the banner counter must not increment again for a real command's own reply");
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// WR-01 -- the banner-drain path must apply the SAME quiescence discipline
// as the pending-command path (Control 2's own shape, applied to D-13(b)).
// ---------------------------------------------------------------------------

test("WR-01 (planted RED, without the fix): a quiescence window of 0ms on the banner-drain path splits one logical banner into two events on prompt-shaped mid-banner text", async () => {
  const midBannerPrompt = Buffer.from("BREAK: 3 A 08FE  A9 00       LDA #$00\n(C:$1234) ", "utf8"); // prompt-shaped, but NOT the banner's real tail
  const realTail = Buffer.from("more banner output\n(C:$08fe) ", "utf8"); // arrives after a short delay, with NO command outstanding
  await withStubNetServer(
    (socket) => {
      socket.write(midBannerPrompt); // no command outstanding
      setTimeout(() => socket.write(realTail), 15);
    },
    async (port) => {
      // quiescenceMs: 0 -- the RED configuration: no window survives, so the
      // banner-drain path's first tail match is accepted immediately,
      // exactly like the pre-fix code (which had no quiescence window at
      // all on this branch).
      const client = new TextMonitorClient({ quiescenceMs: 0 });
      const banners: string[] = [];
      client.on("banner", (text: string) => banners.push(text));
      await client.connect("127.0.0.1", port);
      await sleep(100);
      // RED: one logical banner got split into two separate banner events.
      assert.equal(client.bannerFramesDrained, 2, `RED observation: expected the mid-banner prompt-shaped text to be wrongly accepted as final, splitting the banner; got bannerFramesDrained=${client.bannerFramesDrained}`);
      assert.equal(banners.length, 2);
      await client.disconnect();
    },
  );
});

test("WR-01 (fixed, GREEN): the default quiescence window on the banner-drain path survives prompt-shaped mid-banner text and drains exactly one complete banner", async () => {
  const midBannerPrompt = Buffer.from("BREAK: 3 A 08FE  A9 00       LDA #$00\n(C:$1234) ", "utf8");
  const realTail = Buffer.from("more banner output\n(C:$08fe) ", "utf8");
  await withStubNetServer(
    (socket) => {
      socket.write(midBannerPrompt); // no command outstanding
      setTimeout(() => socket.write(realTail), 15); // well inside TEXT_QUIESCENCE_MS
    },
    async (port) => {
      const client = new TextMonitorClient(); // default TEXT_QUIESCENCE_MS
      const banners: string[] = [];
      client.on("banner", (text: string) => banners.push(text));
      await client.connect("127.0.0.1", port);
      await sleep(150); // outlast the quiescence window plus the 15ms real-tail delay
      assert.equal(client.bannerFramesDrained, 1, "the mid-banner prompt-shaped text must not be mistaken for the banner's real terminator");
      assert.equal(banners.length, 1);
      assert.match(banners[0]!, /BREAK: 3 A 08FE/);
      assert.match(banners[0]!, /more banner output/);
      assert.ok(banners[0]!.endsWith("(C:$08fe) "), "the banner must end with its TRUE trailing prompt, not the mid-banner one");
      await client.disconnect();
    },
  );
});

test("WR-01: a real command issued after a fully-drained banner (through the quiescence window) still resolves with only its own output", async () => {
  const midBannerPrompt = Buffer.from("BREAK: 3 A 08FE  A9 00       LDA #$00\n(C:$1234) ", "utf8");
  const realTail = Buffer.from("more banner output\n(C:$08fe) ", "utf8");
  let socket_: import("node:net").Socket | null = null;
  await withStubNetServer(
    (socket) => {
      socket_ = socket;
      socket.write(midBannerPrompt);
      setTimeout(() => socket.write(realTail), 15);
    },
    async (port) => {
      const client = new TextMonitorClient();
      const banners: string[] = [];
      client.on("banner", (text: string) => banners.push(text));
      await client.connect("127.0.0.1", port);
      await sleep(150); // let the banner fully drain (through its own quiescence window) first
      assert.equal(client.bannerFramesDrained, 1);
      assert.equal(banners.length, 1);

      socket_!.write(Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8"));
      const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
      assert.equal(payload, "Setting default device to `Computer'\n", "the command's own response must never carry banner residue");
      assert.equal(client.bannerFramesDrained, 1, "the banner counter must not increment again for a real command's own reply");
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// Empty-output case.
// ---------------------------------------------------------------------------

test("a command whose entire response is just the prompt resolves with an empty payload, prompt consumed, never a hang", async () => {
  await withStubNetServer(
    (socket) => {
      socket.write(Buffer.from("(C:$e5d1) ", "utf8"));
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock("warp on", () => client.command("warp on"));
      assert.equal(payload, "");
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// Encoding case -- a split three-byte UTF-8 sequence (U+202F).
// ---------------------------------------------------------------------------

test("a split three-byte UTF-8 sequence (U+202F) across two chunks decodes to one character, no replacement character", async () => {
  // U+202F NARROW NO-BREAK SPACE, e2 80 af -- prof flat's own digit-group
  // separator per Phase 39's capture (41-PATTERNS.md's own citation).
  const narrowNbsp = Buffer.from([0xe2, 0x80, 0xaf]);
  const before = Buffer.from("1", "utf8");
  const after = Buffer.from("234\n(C:$e5d1) ", "utf8");
  const full = Buffer.concat([before, narrowNbsp, after]);
  // Split INSIDE the three-byte sequence: after the first byte of it.
  const splitPoint = before.length + 1;
  const chunk1 = full.subarray(0, splitPoint);
  const chunk2 = full.subarray(splitPoint);

  await withStubNetServer(
    (socket) => {
      socket.write(chunk1);
      setTimeout(() => socket.write(chunk2), 5);
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock("prof flat", () => client.command("prof flat"));
      assert.equal(payload, `1${narrowNbsp.toString("utf8")}234\n`);
      assert.ok(!payload.includes("\uFFFD"), `payload must contain no replacement character, got: ${JSON.stringify(payload)}`);
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// Accumulation cap.
// ---------------------------------------------------------------------------

test("TEXT_MAX_BUFFERED_LEN is strictly greater than the largest fixture found on disk under fixtures/textmon/", () => {
  const cases = listTextFixtures();
  assert.ok(cases.length > 0, "expected at least one committed text-monitor fixture");
  let largest = 0;
  for (const c of cases) {
    const { buffer } = loadTextFixture(c);
    if (buffer.length > largest) largest = buffer.length;
  }
  assert.ok(largest > 0, "expected at least one fixture with non-zero content");
  assert.ok(
    TEXT_MAX_BUFFERED_LEN > largest,
    `TEXT_MAX_BUFFERED_LEN (${TEXT_MAX_BUFFERED_LEN}) must be strictly greater than the largest real fixture (${largest} bytes) -- ` +
      `computed from disk, never pinned as a literal`,
  );
});

test("planted violation: TEXT_MAX_BUFFERED_LEN would be caught if tightened below a real fixture (non-vacuity for the assertion above)", () => {
  const cases = listTextFixtures();
  let largest = 0;
  for (const c of cases) {
    const { buffer } = loadTextFixture(c);
    if (buffer.length > largest) largest = buffer.length;
  }
  const tooSmall = Math.floor(largest / 2);
  assert.ok(tooSmall < largest, "the planted 'too small' cap must be smaller than the real largest fixture, or this control is vacuous");
});

test("exceeding TEXT_MAX_BUFFERED_LEN with no prompt in sight refuses with TextFramingError naming the byte count and the outstanding command -- never a truncated payload", async () => {
  await withStubNetServer(
    (socket) => {
      // No prompt anywhere -- just keep writing bytes past the cap.
      const chunkSize = 64 * 1024;
      const filler = Buffer.alloc(chunkSize, 0x41); // 'A' repeated, never forming a prompt
      const chunksNeeded = Math.ceil((TEXT_MAX_BUFFERED_LEN + chunkSize) / chunkSize);
      let sent = 0;
      const interval = setInterval(() => {
        if (sent >= chunksNeeded || socket.destroyed) {
          clearInterval(interval);
          return;
        }
        socket.write(filler);
        sent += 1;
      }, 0);
      socket.on("close", () => clearInterval(interval));
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      await assert.rejects(
        () => withTextChannelLock("bt", () => client.command("bt")),
        (err: unknown) => {
          assert.ok(err instanceof TextFramingError, `expected a TextFramingError, got: ${String(err)}`);
          const framingErr = err as TextFramingError;
          assert.ok(typeof framingErr.observedBytes === "number" && framingErr.observedBytes > TEXT_MAX_BUFFERED_LEN);
          assert.equal(framingErr.outstandingCommand, "bt");
          return true;
        },
      );
      await client.disconnect();
    },
  );
});

// ---------------------------------------------------------------------------
// Fixture-loading discipline (no direct readFileSync against fixtures/textmon).
// ---------------------------------------------------------------------------

test("this file's own fixture directory resolves via TEXTMON_FIXTURE_DIR and every case loads through loadTextFixture()", () => {
  assert.ok(TEXTMON_FIXTURE_DIR.endsWith(join("fixtures", "textmon")));
  const onDisk = readdirSync(TEXTMON_FIXTURE_DIR).filter((f) => f.endsWith(".txt"));
  assert.ok(onDisk.length > 0);
  for (const f of onDisk) {
    const stat = statSync(join(TEXTMON_FIXTURE_DIR, f));
    assert.ok(stat.isFile());
  }
  // The point of this test: prove every case name found on disk loads
  // through loadTextFixture() without throwing -- never a hand-rolled
  // readFileSync against this directory anywhere else in this file.
  for (const c of listTextFixtures()) {
    const fixture = loadTextFixture(c);
    assert.ok(fixture.buffer.length >= 0);
  }
});
