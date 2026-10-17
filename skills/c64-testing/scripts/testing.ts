// The c64-testing script. test runs a scenario on the original and the
// rebuild in one emulator; run runs steps on one side and writes what they
// ask for; record and replay play a session in the replay core (c64run) and
// compare the rebuild with it; diff shows what changed between two states;
// checklist gives the Markdown list for a human tester.

import { COVERAGE } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { C64RunSession, PAL_FRAME_CYCLES } from "#src/native/c64run.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { OPTIONS, runScript, UsageError, type Call, type CommandSpec } from "#src/script.ts";
import { diffFiles } from "./lib/diff-files.ts";
import { play } from "./lib/play.ts";
import { readRecordFile, record, RECORDING_FILES } from "./lib/recording.ts";
import { replay } from "./lib/replay.ts";
import { runFile } from "./lib/runs.ts";
import { readScenario, runScenario, type Scenario, type ScenarioResult } from "./lib/scenario.ts";

/** The default port of the --play page: next to the Host Runtime's 6464. */
const DEFAULT_HTTP_PORT = 6465;

/** Behavior that only a person can judge. */
const ALWAYS = [
  "The controls respond as fast as in the original.",
  "The animation is smooth and has no glitches.",
  "The music and the sound effects sound the same as in the original.",
  "The game flow and the level changes work from start to end.",
  "Nothing unexpected happens outside the tested scenarios.",
];

async function test(call: Call): Promise<ScenarioResult> {
  const scenario = readScenario(call.subject(0));
  const out = call.string("out");
  let client: ViceSessionClient;
  try {
    client = await ViceSessionClient.open({ videoStandard: scenario.videoStandard ?? "pal" });
  } catch (error) {
    if (!(error instanceof WireFailure)) throw error;
    return { result: "INCONCLUSIVE", scenario: scenario.name, reason: `no emulator: ${error.message}`, checkpoints: [], differences: [] };
  }
  try {
    return await runScenario(client, scenario, out === undefined ? {} : { out });
  } finally {
    await client.close();
  }
}

async function recordCommand(call: Call): Promise<Record<string, unknown>> {
  const playing = call.flag("play");
  if (!playing && (call.count("joystick") !== undefined || call.count("http-port") !== undefined)) throw new UsageError("--joystick and --http-port are for --play");
  const joystick = (call.count("joystick") ?? 2) as 1 | 2;
  const httpPort = call.count("http-port") ?? DEFAULT_HTTP_PORT;
  const out = call.string("out")!;
  const file = readRecordFile(call.subject(0));
  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-record-");
  try {
    const person = playing
      ? async (session: C64RunSession) => {
          const ready = (url: string) => process.stderr.write("Open " + url + ". The start screen is frozen. Press Start on the page to play, End to save the recording, or Cancel.\n");
          return (await play(session, { httpPort, joystick, ready })) === "cancelled" ? "the user cancelled the session on the page" : undefined;
        }
      : undefined;
    const outcome = await record(core, file, workspace, person);
    const summary = {
      name: file.name,
      frames: Math.round(outcome.recording.ticks / PAL_FRAME_CYCLES),
      inputSites: outcome.recording.sites.length,
      events: outcome.recording.events.length,
      // The instructions in the coverage map: 0 when the program never read its input from RAM.
      executed: outcome.coverage.reduce((count, byte) => count + ((byte & COVERAGE.ramExecute) === 0 ? 0 : 1), 0),
    };
    if (outcome.reason !== undefined) return { result: "FAIL", recorded: false, reason: outcome.reason, ...summary };
    const files = [
      writeReported(`${out}/${RECORDING_FILES.recording}`, `${JSON.stringify(outcome.recording, null, 2)}\n`, { what: "--out" }),
      writeReported(`${out}/${RECORDING_FILES.reads}`, outcome.reads, { what: "--out" }),
      writeReported(`${out}/${RECORDING_FILES.coverage}`, outcome.coverage, { what: "--out" }),
    ];
    return { result: "PASS", recorded: true, out, ...summary, files };
  } finally {
    await core.close();
    workspace.remove();
  }
}

function checklist(call: Call): { text: string } {
  const lines = ["# Playtest checklist", ""];
  for (const path of call.subjects) {
    const scenario: Scenario = readScenario(path);
    lines.push(`## ${scenario.name}`, "");
    for (const step of scenario.steps) if ("observe" in step) lines.push(`- [ ] At "${step.observe}", the rebuild looks and behaves as the original.`);
    lines.push("");
  }
  lines.push("## Application", "");
  for (const item of call.strings("item")) lines.push(`- [ ] ${item}`);
  for (const item of ALWAYS) lines.push(`- [ ] ${item}`);
  return { text: `${lines.join("\n")}\n` };
}

const STATE_ITEM = "a name or a $ address, with :size for more than one byte, for example room:2";

const COMMANDS: CommandSpec[] = [
  {
    name: "test",
    summary: "Runs a scenario on the original and then on the rebuild in one emulator. result is PASS, FAIL with the differences, or INCONCLUSIVE with the reason.",
    subjects: [{ name: "<scenario.json>", help: "a scenario file, relative to the project folder. See references/scenario-format.md" }],
    options: { out: { ...OPTIONS.out, value: "<dir>", help: "with a FAIL, write both screens, the difference image and memory.json with each differing byte into this folder" } },
    run: test,
  },
  {
    name: "run",
    summary: "Runs the steps of a run file in its own emulator and writes what they ask for into --out: screens, coverage maps, snapshot files, traces, and results.json with the observations. result is FAIL when a step did not run.",
    subjects: [{ name: "<run.json>", help: "a run file, relative to the project folder. See references/scenario-format.md, section Runs" }],
    options: { out: { ...OPTIONS.out, value: "<dir>", required: true, help: "the folder for the files of the steps and results.json" } },
    run: async (call) => {
      const { output, failed } = await runFile(call.subject(0), call.string("out")!);
      return { result: failed ? "FAIL" : "PASS", ...output };
    },
  },
  {
    name: "record",
    summary: "Plays the steps of a record file on the original in the replay core (c64run), and writes the session as a recording folder: recording.json, reads.txt and coverage.bin. result is FAIL when the session did not complete.",
    subjects: [{ name: "<record.json>", help: "a record file, relative to the project folder. See references/recording-format.md" }],
    options: {
      out: { ...OPTIONS.out, value: "<dir>", required: true, help: "the recording folder, for example tests/recordings/<name>" },
      play: { kind: "flag", help: "a person plays after the steps: the script prints the address of a page on stderr. The page shows the start screen frozen until Start. End saves the recording, Cancel ends without one" },
      joystick: { kind: "count", value: "<1|2>", min: 1, max: 2, help: "with --play: the port of the arrow keys, space and the gamepad (default 2)" },
      "http-port": { kind: "count", value: "<n>", min: 0, max: 65535, help: `with --play: the port of the page (default ${DEFAULT_HTTP_PORT})` },
    },
    run: recordCommand,
  },
  {
    name: "replay",
    summary: "Replays a recording on the original, which must end with the recorded state, and with --rebuild on the rebuild, which must have the state of the original at each checkpoint. result is PASS, FAIL or INCONCLUSIVE.",
    subjects: [{ name: "<recording>", help: "a folder that record wrote, relative to the project folder" }],
    options: {
      checkpoint: { kind: "text", value: "<routine>", help: "the name or $ address of a routine: each entry is a checkpoint. Without it, the comparison of the record file" },
      state: { kind: "text", value: "<item>", multiple: true, help: `the state to compare at each checkpoint: ${STATE_ITEM}` },
      pin: { kind: "text", value: "<item>", multiple: true, help: `random state in RAM, in the form of --state: at each checkpoint the rebuild gets the original's values there` },
      rebuild: { kind: "path", value: "<prg>", help: "the rebuild to compare with the original" },
      symbols: { ...OPTIONS.symbols, help: "the names of the rebuild: the c64-assembler output (default: the symbols of the recording)" },
      out: { ...OPTIONS.out, value: "<dir>", help: "with a FAIL, write the RAM of both sides at the first different checkpoint into this folder" },
    },
    notes: "A recording without names takes the names of the knowledge for the original. A $ address is an address of the original: on the rebuild it moves with the name before it.",
    run: (call) => {
      const [checkpoint, rebuild, symbols, out] = [call.string("checkpoint"), call.string("rebuild"), call.string("symbols"), call.string("out")];
      return replay({ folder: call.subject(0), state: call.strings("state"), pin: call.strings("pin"), ...(checkpoint === undefined ? {} : { checkpoint }), ...(rebuild === undefined ? {} : { rebuild }), ...(symbols === undefined ? {} : { symbols }), ...(out === undefined ? {} : { out }) });
    },
  },
  {
    name: "diff",
    summary: "What changed between two machine states of one kind: two snapshot files (snapshot.vsf), two memory files of runs (memory.bin), or two observations of runs (results.json:<name>).",
    subjects: [
      { name: "<a>", help: "the first state, relative to the project folder" },
      { name: "<b>", help: "the second state" },
    ],
    options: {
      gap: { kind: "count", value: "<n>", min: 0, max: 0xffff, default: 0, help: "join changed ranges across at most n equal bytes (default 0)" },
      "max-listed": OPTIONS["max-listed"],
      ntsc: { kind: "flag", help: "the snapshots are of an NTSC machine (default PAL)" },
      at: { kind: "address", value: "<address>", help: "the address of the first byte of a memory file that is shorter than 64 KiB" },
      out: { ...OPTIONS.out, value: "<file>", help: "also write all ranges to this file" },
    },
    run: (call) => {
      const [at, out] = [call.address("at"), call.string("out")];
      return diffFiles(call.subject(0), call.subject(1), { gap: call.count("gap")!, max: call.count("max-listed")!, ntsc: call.flag("ntsc"), ...(at === undefined ? {} : { at }), ...(out === undefined ? {} : { out }) });
    },
  },
  {
    name: "checklist",
    summary: "The playtest checklist for a human tester as Markdown in text: the checkpoints of the scenarios, and the behavior that automated scenarios cannot check.",
    subjects: [{ name: "<scenario.json>", help: "a scenario file", list: true }],
    options: { item: { kind: "text", value: "<text>", multiple: true, help: "an application-specific line" } },
    run: checklist,
  },
];

await runScript({
  name: "testing",
  summary: "Tests a rebuild against the original: scenarios in VICE, runs, recorded play sessions in the replay core, state differences, and a checklist for a human tester.",
  names: knowledgeNames,
  commands: COMMANDS,
});
