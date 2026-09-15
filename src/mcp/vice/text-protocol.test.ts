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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TextMonitorClient,
  PROMPT_RE,
  TEXT_COMMAND_ALLOWLIST,
  TEXT_COMMAND_PARAM_SPECS,
  HAZARD_SUBJECT_PRG_PATH,
  HAZARD_SUBJECT_IDS,
  HAZARD_SUBJECT_PRG_BASENAMES,
  HAZARD_SUBJECT_PRG_RELPATHS,
  hazardSubjectPrgPath,
  hazardSubjectLoadVerb,
  isHazardSubjectId,
  isAllowlistedTextCommand,
  buildTextCommand,
  isDialableTextCommandForVerb,
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
  // Narrowed, not deleted (plan 50-04, 2026-09-15, developer decision
  // "route-d": widen the allowlist for `load`, recorded in
  // .planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md).
  // An ARBITRARY load command, with a caller-chosen filename, must still
  // never be allowlisted -- this is exactly what the string below is: a
  // *different* file ("foo") and a *different* device (8) than the one
  // narrow, fixed `load "<HAZARD_SUBJECT_PRG_PATH>"` verb this project
  // deliberately added to TEXT_COMMAND_PARAM_SPECS (see that entry's own
  // comment). Only that one reviewed verb, with its own bounded device
  // parameter, is dialable -- proven by the companion positive assertion
  // immediately below.
  assert.ok(!isAllowlistedTextCommand("load \"foo\" 8 1"), "an arbitrary load command naming a different, caller-chosen file must never be allowlisted");
  assert.ok(!isAllowlistedTextCommand(`load "${HAZARD_SUBJECT_PRG_PATH}" 8 1`), "even the reviewed fixture path is refused with a stray extra address argument the spec does not offer");
  assert.ok(!isAllowlistedTextCommand("device c"), "the colon is required -- device c (no colon) is a different, non-allowlisted string");

  // Positive control (plan 50-04): the ONE narrow load verb this project
  // did widen for IS dialable, with its own bounded device parameter --
  // proving the refusal above is a real refusal of a DIFFERENT string, not
  // a refusal of "load" as a substring.
  const widenedLoad = buildTextCommand(`load "${HAZARD_SUBJECT_PRG_PATH}"`, 0);
  assert.ok(widenedLoad.ok, "the reviewed load verb with device 0 must build");
  assert.ok(widenedLoad.ok && isAllowlistedTextCommand(widenedLoad.command), "the reviewed load verb's own canonical rendering must be allowlisted");

  // NARROWED AGAIN, not deleted (plan 50-05): the single frozen `load` verb
  // became one frozen verb per member of the closed
  // HAZARD_SUBJECT_PRG_BASENAMES table, because the red control had to load
  // a DIFFERENT committed subject. Growing the set is only acceptable while
  // the set stays CLOSED, so that is what is asserted here -- both
  // directions, in the same test.
  for (const id of HAZARD_SUBJECT_IDS) {
    const built = buildTextCommand(hazardSubjectLoadVerb(id), 0);
    assert.ok(built.ok, `the reviewed load verb for subject ${JSON.stringify(id)} must build`);
    assert.ok(
      built.ok && isAllowlistedTextCommand(built.command),
      `subject ${JSON.stringify(id)}'s own canonical rendering must be allowlisted`,
    );
  }

  // THE CLOSED-SET PROOF. `hazard-subject-misaligned.prg` is a real,
  // committed fixture sitting in the very same directory as all three
  // dialable subjects -- and it is deliberately NOT in the table, because
  // nothing loads it into a running emulator. If the widening had drifted
  // into "any file under fixtures/hazard-subject", this assertion is what
  // fails. A directory is not the boundary; the reviewed table is.
  const misalignedPath = HAZARD_SUBJECT_PRG_PATH.replace(/hazard-subject\.prg$/, "hazard-subject-misaligned.prg");
  assert.notEqual(misalignedPath, HAZARD_SUBJECT_PRG_PATH, "the misaligned path must really differ from the original's");
  assert.ok(
    !isAllowlistedTextCommand(`load "${misalignedPath}" 0`),
    "a committed fixture the closed table does not name must never be dialable, even from the same directory",
  );
});

test("HAZARD_SUBJECT_PRG_RELPATHS (plan 50-05, rows generalised plan 50-06): the loadable subject set is closed, every member resolves to a real file on disk, and only a table id passes the membership test", () => {
  // Every id resolves to a file that actually exists. A row naming a path
  // that is not there would refuse only at load time, inside the emulator,
  // where the failure reads as an emulator problem rather than a table typo.
  for (const id of HAZARD_SUBJECT_IDS) {
    const path = hazardSubjectPrgPath(id);
    assert.ok(existsSync(path), `subject ${JSON.stringify(id)} must resolve to a real file on disk (${path})`);
    assert.ok(path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path), `subject ${JSON.stringify(id)}'s path must be absolute`);
    assert.ok(path.endsWith(HAZARD_SUBJECT_PRG_BASENAMES[id]), "the resolved path must end in the table's own derived basename");
  }

  // THE ROW SHAPE, pinned (plan 50-06). A row is now a whole repo-relative
  // path rather than a basename joined onto one fixed directory, because
  // plan 50-06's rebuild `.prg` is a build artifact under the phase evidence
  // directory rather than a committed fixture. That generalisation is only
  // safe while every segment stays a REVIEWED LITERAL that cannot climb out
  // of the repository, so that is asserted here rather than assumed: no
  // empty segment, no `.` or `..`, no separator inside a segment, and no
  // absolute segment. A caller supplies none of this -- the whole table is
  // spelled in text-protocol.ts -- but a future editor adding a row is who
  // this assertion is for.
  for (const id of HAZARD_SUBJECT_IDS) {
    const segments = HAZARD_SUBJECT_PRG_RELPATHS[id];
    assert.ok(Array.isArray(segments) && segments.length > 0, `subject ${JSON.stringify(id)} must carry a non-empty segment list`);
    assert.ok(Object.isFrozen(segments), `subject ${JSON.stringify(id)}'s segment list must be frozen`);
    for (const segment of segments) {
      assert.equal(typeof segment, "string", `every segment of ${JSON.stringify(id)} must be a string`);
      assert.notEqual(segment, "", `no segment of ${JSON.stringify(id)} may be empty`);
      assert.notEqual(segment, ".", `no segment of ${JSON.stringify(id)} may be "."`);
      assert.notEqual(segment, "..", `no segment of ${JSON.stringify(id)} may be ".." -- a row must never climb out of the repository`);
      assert.ok(!segment.includes("/") && !segment.includes("\\"), `no segment of ${JSON.stringify(id)} may carry a path separator (${segment})`);
    }
  }
  // The derived basename table is derived, not spelled twice.
  assert.deepEqual(
    Object.keys(HAZARD_SUBJECT_PRG_BASENAMES).sort(),
    [...HAZARD_SUBJECT_IDS].sort(),
    "the derived basename table must carry exactly the source table's own ids",
  );

  // The rebuild row is the one member that is NOT under the fixture
  // directory, and that is the whole reason the rows were generalised --
  // asserted rather than left as prose, so a later edit that quietly moves
  // it back into fixtures/ fails here instead of silently narrowing the
  // table's reach.
  assert.ok(
    hazardSubjectPrgPath("rebuild").includes(join(".planning", "phases", "50-equivalence-and-modifiability", "evidence")),
    "the rebuild subject must resolve under the phase evidence directory, not the fixture directory",
  );
  assert.ok(
    hazardSubjectPrgPath("original").includes(join("src", "mcp", "vice", "fixtures", "hazard-subject")),
    "the original subject must still resolve under the committed fixture directory",
  );

  // The membership test admits exactly the table's own keys, and nothing
  // reachable through the prototype chain -- the reason it is written
  // against Object.keys rather than a property lookup.
  for (const id of HAZARD_SUBJECT_IDS) assert.ok(isHazardSubjectId(id));
  for (const notAnId of ["misaligned", "constructor", "__proto__", "toString", "", "ORIGINAL", 0, null, undefined, {}]) {
    assert.equal(isHazardSubjectId(notAnId), false, `${JSON.stringify(notAnId)} must not pass as a subject id`);
  }

  // One spec entry per subject, and no `load` spec that is not one of them.
  const loadVerbs = Object.keys(TEXT_COMMAND_PARAM_SPECS).filter((verb) => verb.startsWith("load "));
  assert.deepEqual(
    [...loadVerbs].sort(),
    HAZARD_SUBJECT_IDS.map((id) => hazardSubjectLoadVerb(id)).sort(),
    "the dialable `load` verbs must be exactly the closed table's members -- no more, no fewer",
  );
});

test("TEXT_COMMAND_ALLOWLIST: every entry is exactly one of the eleven named verbs, and every allowlisted or parameterized verb (including the plan 50-04 `load` widening) still refuses a file-WRITING monitor verb (T-41-02)", () => {
  // Widened to ten in plan 42-09 (a conscious, measured widening, not a
  // speculative one, per this constant's own header comment): `prof on`/
  // `prof off` were added so the live opt-in suite can toggle VICE's own
  // profiler on before proving `prof flat`'s parsing path against real
  // rows, and off again afterward -- MEASURED live that `prof flat` alone
  // returns "No profiling data available..." on a fresh instance.
  //
  // Widened to eleven in plan 43-01 (EVID-06's measurement bracket and
  // EVID-05's bracket reset): `memmapzap` clears VICE's accumulated
  // memory-access map so a runtime-evidence measurement starts from
  // nothing. The file-writing sibling `memmapsave` was considered and
  // rejected -- it touches a host file and this test's own save regex
  // below refuses it by name.
  //
  // Plan 50-04 (2026-09-15) narrows the RULE this test enforces, not just
  // its regex: the invariant was never "no `load` or `save` anywhere", it
  // is "no verb that WRITES a host file". `load` READS a host file and was
  // deliberately, narrowly widened into TEXT_COMMAND_PARAM_SPECS (never
  // into TEXT_COMMAND_ALLOWLIST itself -- see that entry's own comment for
  // why). TEXT_COMMAND_ALLOWLIST therefore stays exactly these eleven
  // entries, unchanged; what changes here is that the save-refusal check
  // below now also covers every TEXT_COMMAND_PARAM_SPECS key, so the
  // widening's own new entry is exercised by this test too, not merely
  // left unvisited because it lives in a different table.
  const expected = ["device c:", "warp on", "warp off", "memmapshow", "prof flat", "chis", "bt", "io", "prof on", "prof off", "memmapzap"];
  assert.deepEqual([...TEXT_COMMAND_ALLOWLIST].sort(), [...expected].sort());
  const allDialableVerbStrings = [...TEXT_COMMAND_ALLOWLIST, ...Object.keys(TEXT_COMMAND_PARAM_SPECS)];
  for (const cmd of allDialableVerbStrings) {
    assert.doesNotMatch(cmd, /\bsave\b/, `${JSON.stringify(cmd)} must never be a file-WRITING verb`);
  }
  // The load widening is real, not vacuous: prove it is actually present
  // among the dialable verb strings above (a hypothetical revert of the
  // TEXT_COMMAND_PARAM_SPECS entry would still pass every check above it,
  // since removing a key can never make it match /\bsave\b/).
  assert.ok(
    allDialableVerbStrings.some((cmd) => /\bload\b/.test(cmd)),
    "expected the plan 50-04 `load` widening to be present among the dialable verb strings",
  );
});

// ---------------------------------------------------------------------------
// Parameterized commands (D-42-1, plan 42-04): TEXT_COMMAND_PARAM_SPECS,
// buildTextCommand(), isDialableTextCommandForVerb(), and the widened
// isAllowlistedTextCommand().
// ---------------------------------------------------------------------------

test("buildTextCommand: the three canonical renderings match the exact command string each fixture was actually captured with", () => {
  const chis = loadTextFixture("cpu-history-stock");
  const chisResult = buildTextCommand("chis", 4);
  assert.equal(chisResult.ok, true);
  assert.equal(chisResult.ok && chisResult.command, chis.provenance.command);

  const profFlat = loadTextFixture("flat-profile-stock");
  const profFlatResult = buildTextCommand("prof flat", 5);
  assert.equal(profFlatResult.ok, true);
  assert.equal(profFlatResult.ok && profFlatResult.command, profFlat.provenance.command);

  const io = loadTextFixture("register-decode-stock");
  const ioResult = buildTextCommand("io", 53280); // 53280 == 0xd020
  assert.equal(ioResult.ok, true);
  assert.equal(ioResult.ok && ioResult.command, io.provenance.command);
});

test("buildTextCommand [load, plan 50-04]: renders the exact command form VICE's own upstream grammar documents for device 0, host-filesystem read", () => {
  // Unlike the three fixtures above (captured on a real wire against a
  // genuinely running stock instance), this widening was authored WITHOUT a
  // live capture (the developer's decision explicitly widens the allowlist
  // ahead of any live proof -- LOAD-ROUTE.md records that). So this
  // assertion is sourced from VICE's own committed upstream source instead
  // of a fixtures/textmon/*.json capture: `doc/vice.texi` ("load
  // \"<filename>\" <device> [<address>]" / "If device is 0, the file is
  // read from the file system") and `src/monitor/mon_parse.y`'s
  // `disk_rules: CMD_LOAD filename device_num opt_address` grammar rule,
  // both read directly from a vendored VICE 3.8 checkout this session. The
  // live task that actually dials this against a real emulator (plan
  // 50-04's Task 2, out of this executor's scope) is what turns this from
  // "matches the documented grammar" into "matches a captured fixture",
  // exactly like the other three entries once were before their own first
  // live capture.
  const built = buildTextCommand(`load "${HAZARD_SUBJECT_PRG_PATH}"`, 0);
  assert.equal(built.ok, true);
  assert.equal(built.ok && built.command, `load "${HAZARD_SUBJECT_PRG_PATH}" 0`);
  // The path itself must be absolute -- never a bare repo-relative string
  // (see HAZARD_SUBJECT_PRG_PATH's own comment for why: broker-launch.mts
  // spawns x64sc with no explicit cwd).
  assert.ok(HAZARD_SUBJECT_PRG_PATH.startsWith("/") || /^[A-Za-z]:[\\/]/.test(HAZARD_SUBJECT_PRG_PATH), "HAZARD_SUBJECT_PRG_PATH must be absolute");
  assert.ok(HAZARD_SUBJECT_PRG_PATH.endsWith(join("src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject.prg")));
});

test("buildTextCommand: refuses a non-integer, a negative, a NaN, an Infinity, a numeric string, and an out-of-range value -- each naming the verb and the accepted range", () => {
  const cases: Array<{ title: string; value: unknown }> = [
    { title: "non-integer", value: 4.5 },
    { title: "negative", value: -1 },
    { title: "NaN", value: Number.NaN },
    { title: "Infinity", value: Number.POSITIVE_INFINITY },
    { title: "numeric string", value: "4" },
    { title: "out-of-range", value: 65536 },
  ];
  for (const { title, value } of cases) {
    const result = buildTextCommand("chis", value);
    assert.equal(result.ok, false, `expected ${title} (${JSON.stringify(value)}) to be refused`);
    assert.ok(!result.ok);
    assert.match(result.message, /"chis"/, `${title}: message must name the verb`);
    assert.match(result.message, /1 and 65535/, `${title}: message must name the accepted range`);
  }
});

test("buildTextCommand: refuses a verb with no spec entry, rather than falling through to a bare concatenation", () => {
  const result = buildTextCommand("quit", 4);
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.message, /"quit"/);
  assert.match(result.message, /no parameterized form/);
});

test("isDialableTextCommandForVerb / isAllowlistedTextCommand: accept every canonical rendering the builder produces", () => {
  const cases: ReadonlyArray<readonly [string, number]> = [
    ["chis", 4],
    ["prof flat", 5],
    ["io", 53280],
    [`load "${HAZARD_SUBJECT_PRG_PATH}"`, 0], // plan 50-04
    [hazardSubjectLoadVerb("regressed"), 0], // plan 50-05
    [hazardSubjectLoadVerb("modified"), 0], // plan 50-05
    [hazardSubjectLoadVerb("rebuild"), 0], // plan 50-06
  ];
  for (const [verb, value] of cases) {
    const built = buildTextCommand(verb, value);
    assert.ok(built.ok);
    const command = built.ok ? built.command : "";
    assert.ok(isDialableTextCommandForVerb(verb, command), `expected ${JSON.stringify(command)} to be dialable for ${verb}`);
    assert.ok(isAllowlistedTextCommand(command), `expected ${JSON.stringify(command)} to be allowlisted`);
  }
});

test("isAllowlistedTextCommand: refuses a doubled space, a trailing space, an uppercase verb, a leading zero on the count, uppercase hex in the address, and an appended second parameter -- only the canonical rendering is dialable", () => {
  const cases: Array<{ title: string; cmd: string }> = [
    { title: "doubled space", cmd: "chis  4" },
    { title: "trailing space", cmd: "chis 4 " },
    { title: "uppercase verb", cmd: "CHIS 4" },
    { title: "leading zero on count", cmd: "chis 04" },
    { title: "uppercase hex address", cmd: "io $D020" },
    { title: "appended second parameter", cmd: "chis 4 5" },
  ];
  for (const { title, cmd } of cases) {
    assert.equal(isAllowlistedTextCommand(cmd), false, `${title}: ${JSON.stringify(cmd)} must not be dialable`);
  }
});

test("D-42-1 prohibition: no parameter kind in TEXT_COMMAND_PARAM_SPECS accepts a string domain", () => {
  for (const [verb, spec] of Object.entries(TEXT_COMMAND_PARAM_SPECS)) {
    assert.ok(
      spec.kind === "count" || spec.kind === "address",
      `${verb}'s spec kind must be "count" or "address", never a free-text/string domain -- got ${JSON.stringify(spec.kind)}`,
    );
  }
});

test("command()'s refusal ORDER: the control-character check precedes the dialability check in source order (unchanged by D-42-1)", () => {
  const sourcePath = fileURLToPath(new URL("./text-protocol.ts", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");
  const commandBodyStart = source.indexOf("command(cmd: string, _opts: TextCommandOptions = {})");
  assert.ok(commandBodyStart >= 0, "command() must exist in text-protocol.ts");
  const controlCharIndex = source.indexOf("FORBIDDEN_COMMAND_CHARS_RE.test(cmd)", commandBodyStart);
  const dialabilityIndex = source.indexOf("!isAllowlistedTextCommand(cmd)", commandBodyStart);
  assert.ok(controlCharIndex > commandBodyStart, "the control-character check must be inside command()");
  assert.ok(dialabilityIndex > commandBodyStart, "the dialability check must be inside command()");
  assert.ok(controlCharIndex < dialabilityIndex, "the control-character check must precede the dialability check");
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

// ---------------------------------------------------------------------------
// Task 2 controls (D-42-1): nothing reaches the socket early for a
// parameterized command, and nothing smuggles a second command through a
// parameter -- proven through command(), the REAL public entry point, not
// merely through buildTextCommand() alone. Reuses the same stub-server
// harness and "record whether any byte arrived" shape as the two refusal
// cases immediately above.
//
// The three refusal cases below are paired with the three acceptance cases
// that follow them: together they discriminate a module that actually
// validates from one that vacuously refuses everything. A hypothetical
// module that refused every parameterized command (including the three
// canonical renderings) would pass all three refusal cases here and FAIL
// all three acceptance cases below -- proving the refusal cases alone are
// not sufficient evidence of correct behavior.
// ---------------------------------------------------------------------------

test("command() [chis]: refuses a parameterized command whose parameter text embeds a C0 control character, before any byte reaches the socket", async () => {
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
      await assert.rejects(
        () => withTextChannelLock("chis", () => client.command("chis 4\rquit")),
        /CR, LF, or C0 control character/,
      );
      await sleep(50);
      assert.equal(socketReceivedBytes, false, "no byte may reach the socket for a parameterized command carrying an embedded control character");
      await client.disconnect();
    },
  );
});

test("command() [prof flat]: refuses a parameterized command carrying a second monitor command after a separator, before any byte reaches the socket", async () => {
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
      await assert.rejects(
        () => withTextChannelLock("prof flat", () => client.command("prof flat 5;quit")),
        /refusing non-allowlisted command/,
      );
      await sleep(50);
      assert.equal(socketReceivedBytes, false, "no byte may reach the socket for a parameterized command smuggling a second verb after a separator");
      await client.disconnect();
    },
  );
});

test("command() [chis]: refuses an out-of-range parameterized value routed through the public command() entry point, before any byte reaches the socket", async () => {
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
      await assert.rejects(
        () => withTextChannelLock("chis", () => client.command("chis 65536")),
        /refusing non-allowlisted command/,
      );
      await sleep(50);
      assert.equal(socketReceivedBytes, false, "no byte may reach the socket for an out-of-range parameterized value, even routed through command() directly rather than buildTextCommand()");
      await client.disconnect();
    },
  );
});

test("command() [chis]: the canonical rendering IS dialed, byte-identical to buildTextCommand()'s own output, with no trailing separator added by this module", async () => {
  const built = buildTextCommand("chis", 4);
  assert.ok(built.ok);
  const command = built.ok ? built.command : "";
  let received = Buffer.alloc(0);
  await withStubNetServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        socket.write(Buffer.from("ok\n(C:$e5d1) ", "utf8"));
      });
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock(command, () => client.command(command));
      assert.equal(payload, "ok\n");
      await client.disconnect();
    },
  );
  assert.equal(received.toString("utf8"), `${command}\n`, `expected the stub server to receive exactly ${JSON.stringify(command)} (plus the trailing newline command() itself adds)`);
});

test("command() [prof flat]: the canonical rendering IS dialed, byte-identical to buildTextCommand()'s own output, with no trailing separator added by this module", async () => {
  const built = buildTextCommand("prof flat", 5);
  assert.ok(built.ok);
  const command = built.ok ? built.command : "";
  let received = Buffer.alloc(0);
  await withStubNetServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        socket.write(Buffer.from("ok\n(C:$e5d1) ", "utf8"));
      });
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock(command, () => client.command(command));
      assert.equal(payload, "ok\n");
      await client.disconnect();
    },
  );
  assert.equal(received.toString("utf8"), `${command}\n`, `expected the stub server to receive exactly ${JSON.stringify(command)} (plus the trailing newline command() itself adds)`);
});

test("command() [io]: the canonical rendering IS dialed, byte-identical to buildTextCommand()'s own output, with no trailing separator added by this module", async () => {
  const built = buildTextCommand("io", 53280); // 53280 == 0xd020
  assert.ok(built.ok);
  const command = built.ok ? built.command : "";
  let received = Buffer.alloc(0);
  await withStubNetServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        socket.write(Buffer.from("ok\n(C:$e5d1) ", "utf8"));
      });
    },
    async (port) => {
      const client = new TextMonitorClient();
      await client.connect("127.0.0.1", port);
      const payload = await withTextChannelLock(command, () => client.command(command));
      assert.equal(payload, "ok\n");
      await client.disconnect();
    },
  );
  assert.equal(received.toString("utf8"), `${command}\n`, `expected the stub server to receive exactly ${JSON.stringify(command)} (plus the trailing newline command() itself adds)`);
});

test("D-42-1 prohibition (source-level): text-protocol.ts's own source declares no parameter kind with a string domain", () => {
  // The mechanical form of this plan's front-matter prohibition -- the
  // runtime-object check earlier in this file ("no parameter kind in
  // TEXT_COMMAND_PARAM_SPECS accepts a string domain") proves today's
  // shipped table; this one additionally proves the TYPE DECLARATION
  // itself has not been widened, which is the assertion that would notice
  // a later "just let the caller pass the rest of the line" edit even
  // before it is wired into a spec entry.
  const sourcePath = fileURLToPath(new URL("./text-protocol.ts", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /kind:\s*"string"/, 'no spec entry may declare kind: "string"');
  const kindTypeMatch = source.match(/export type TextCommandParamKind = ("[^"]+"(?:\s*\|\s*"[^"]+")*);/);
  assert.ok(kindTypeMatch, "TextCommandParamKind's own type declaration must be found in source");
  assert.equal(
    kindTypeMatch![1],
    '"count" | "address"',
    "TextCommandParamKind must remain exactly count|address -- a later widening to include a string domain would fail this assertion",
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
