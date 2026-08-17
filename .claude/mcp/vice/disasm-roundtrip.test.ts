// disasm-roundtrip.test.ts
//
// The headline correctness check for the phase (criterion 4, DISASM-03,
// D-08/D-09): feeds `vice_disassemble`'s OWN `listing` output to a REAL
// `acme` process and asserts the reassembled bytes equal the original byte
// stream exactly, across all 256 opcodes -- then separately asserts D-09's
// `!byte` substitution table (`disasm-opcodes.ts`'s `acmeExpressible`) in
// BOTH directions against that same real assembler, so it can neither
// under-substitute (shipping a mnemonic that does not reassemble) nor
// over-substitute (hiding a mnemonic ACME genuinely accepts, or -- the
// subtler failure this suite actually found -- accepting a mnemonic+mode
// that ACME resolves to a DIFFERENT opcode byte than the one it was
// decoded from).
//
// ---------------------------------------------------------------------------
// GATE (D-08, criterion 4's "rather than skipped")
// ---------------------------------------------------------------------------
// Exactly one test always runs, never skipped: "ACME availability gate
// (D-08)". With VICE_REQUIRE_ACME set (CI's Test step, .github/workflows/ci.yml)
// a missing ACME FAILS that test. Locally, with no ACME installed, every
// other test in this file skips with a named reason via node:test's own
// `{ skip }` option -- SKIP_REASON is computed ONCE at module scope, exactly
// stock-live.test.ts's own pattern, never a hand-rolled `if (!available)
// return` (which would report a false PASS rather than a SKIP).
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never interpolate the rendered listing (or any test input) into a
//     shell command string. `assemble()` below writes it to a file and
//     spawns `acme` with an argv array (T-04-06-01) -- the same convention
//     `.claude/skills/acme-build/scripts/acme.mjs` already uses for the one
//     other place this repo shells out to ACME.
//   - Never hardcode a static "known unassemblable" list for Suite C. Every
//     assertion in that suite is driven from `disasm-opcodes.ts`'s own
//     `OPCODES` table, so a future correction to that table is
//     automatically re-verified the next time this file runs.
//   - Never treat an ACME stderr WARNING as a failure. ACME 0.97 documents
//     warnings for buggy-but-legal constructs (`jmp ($xxff)`, "unstable"
//     ANE/LXA) -- `assemble()`'s `ok` is `status === 0 && the output file
//     exists`, never a check on stderr being empty.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OPCODES, type OpcodeEntry, type AddressingMode } from "./disasm-opcodes.ts";
import { decode } from "./disasm-decoder.ts";
import { render } from "./disasm-renderer.ts";
import { dispatchStock, type StockDispatchDeps } from "./stock-dispatch.ts";
import { CommandType } from "./stock-protocol.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";

// ---------------------------------------------------------------------------
// Gate: is a real ACME reachable at ACME_BIN?
// ---------------------------------------------------------------------------

const ACME_BIN = process.env.ACME_BIN ?? "acme";

function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8" });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8" });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

const ACME_AVAILABLE = probeAcme();

/** Computed exactly once. Every ACME-dependent test in this file passes this
 * through node:test's own `{ skip }` option -- never a hand-rolled early
 * return, which would report a false PASS rather than a SKIP
 * (stock-live.test.ts's own pattern). */
const SKIP_REASON: string | false = ACME_AVAILABLE
  ? false
  : `disasm-roundtrip.test.ts's ACME-dependent suites are skipped -- no real ACME cross-assembler ` +
    `was found at ACME_BIN="${ACME_BIN}". Set ACME_BIN to an absolute path to a real "acme" binary, ` +
    `or install one (apt-get install acme -- verified against Debian trixie/Ubuntu during planning). ` +
    `CI's build job installs it before this file runs (.github/workflows/ci.yml's "Install ACME ` +
    `cross-assembler" step) and sets VICE_REQUIRE_ACME=1 so a missing ACME there FAILS instead of ` +
    `skipping -- see the "ACME availability gate (D-08)" test below.`;

test("ACME availability gate (D-08)", () => {
  if (process.env.VICE_REQUIRE_ACME) {
    assert.ok(
      ACME_AVAILABLE,
      `VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="${ACME_BIN}" -- criterion 4's ` +
        `"exclusions are enumerated and asserted rather than skipped" requires this to FAIL, never skip, ` +
        `whenever the CI gate expects ACME to be present. .github/workflows/ci.yml's "Install ACME ` +
        `cross-assembler" step should have installed it before this test ran.`,
    );
  }
});

// ---------------------------------------------------------------------------
// assemble(): the ONE place this file shells out to ACME. Argv array, never
// a shell string (T-04-06-01) -- the source text only ever reaches ACME as
// file contents.
// ---------------------------------------------------------------------------

let workDir: string | undefined;
let fileCounter = 0;

function assemble(source: string): { ok: boolean; bytes: Buffer; stderr: string } {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "disasm-roundtrip-"));
  const id = fileCounter++;
  const srcPath = join(workDir, `t${id}.a`);
  const outPath = join(workDir, `t${id}.bin`);
  writeFileSync(srcPath, source);
  const r = spawnSync(ACME_BIN, ["-f", "plain", "-o", outPath, srcPath], { encoding: "utf8" });
  const ok = r.status === 0 && existsSync(outPath);
  const bytes = ok ? readFileSync(outPath) : Buffer.alloc(0);
  return { ok, bytes, stderr: r.stderr ?? "" };
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// A minimal StockConnectSession/StockDispatchDeps pair -- the same shape
// stock-dispatch.test.ts's own buildConformanceSession()/buildConformanceDeps()
// use (not imported from there: that file exports nothing, per its own
// module-local convention). `sendImpl` decides what every client.send() call
// resolves to; this file only ever needs to answer MemoryGet.
// ---------------------------------------------------------------------------

const ROUNDTRIP_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

function buildRoundtripSession(targetId: string, sendImpl: (commandType: number, body: Buffer) => unknown): StockConnectSession {
  const client = Object.assign(new EventEmitter(), {
    connected: true,
    disconnect: async (): Promise<void> => {
      client.connected = false;
    },
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => sendImpl(commandType, body),
  });
  return {
    client: client as unknown as StockConnectSession["client"],
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" as const },
    host: "127.0.0.1",
    port: 6502,
    targetId,
    brokerControl: ROUNDTRIP_BROKER_CONTROL,
    deps: {},
    baselineEpoch: null,
  } as unknown as StockConnectSession;
}

function buildRoundtripDeps(session: StockConnectSession): StockDispatchDeps {
  return {
    ensureLease: async () => ({
      ok: true as const,
      lease: {
        host: session.host,
        port: session.port,
        targetId: session.targetId,
        brokerControl: session.brokerControl,
        epochFile: "",
        supervisorDir: "",
      } as HeldLease,
    }),
    connect: async () => session,
  };
}

/** Answers MemoryGet from a fixed `buffer` addressed at `baseAddress`,
 * slicing out whatever [start, end] range the wire body actually requests --
 * generic over however many bytes stock-disassemble.ts's own over-read math
 * asks for on any given call. */
function memoryGetReplyFrom(buffer: Buffer, baseAddress: number) {
  return (commandType: number, body: Buffer) => {
    assert.equal(commandType, CommandType.MemoryGet, `disasm-roundtrip: unexpected commandType ${commandType}`);
    const start = body.readUInt16LE(1);
    const end = body.readUInt16LE(3);
    const offset = start - baseAddress;
    const length = end - start + 1;
    assert.ok(offset >= 0 && offset + length <= buffer.length, `disasm-roundtrip: requested range $${start.toString(16)}-$${end.toString(16)} is outside the fixture buffer`);
    return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: buffer.subarray(offset, offset + length), related: [] };
  };
}

function toHexArg(value: number): string {
  return `$${value.toString(16)}`;
}

// ---------------------------------------------------------------------------
// Suite A: the full-256-opcode round trip through vice_disassemble's OWN
// listing (D-13, D-09).
// ---------------------------------------------------------------------------

/** One filler set per opcode. Deliberately NOT a single constant (the plan's
 * own instruction) -- $6C and $AD get bespoke fillers that exercise D-10's
 * NMOS page-wrap note and D-11's width-force respectively; branches get a
 * small in-range offset distinct from the general 2-byte filler. */
function fillerForRoundtrip(opcode: number, entry: OpcodeEntry): number[] {
  if (entry.length === 1) return [];
  if (opcode === 0x6c) return [0xff, 0x10]; // jmp ($10ff) -- NMOS page-wrap: low byte $ff
  if (opcode === 0xad) return [0x80, 0x00]; // lda $0080 -- absolute operand below $0100 (D-11 force)
  if (entry.length === 2) {
    if (entry.mode === "relative") return [0x05]; // forward branch, offset +5
    return [0x40]; // zeropage-family / immediate / indirect_x / indirect_y filler
  }
  return [0x00, 0x20]; // length 3, other absolute-family: value $2000 (above $0100, no force needed)
}

function buildFullOpcodeCorpus(): Buffer {
  const bytes: number[] = [];
  for (let op = 0; op <= 0xff; op++) {
    const entry = OPCODES[op]!;
    bytes.push(op, ...fillerForRoundtrip(op, entry));
  }
  return Buffer.from(bytes);
}

test("Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)", { skip: SKIP_REASON }, async () => {
  const BASE_ADDRESS = 0x1000;
  const corpus = buildFullOpcodeCorpus();
  const corpusEnd = BASE_ADDRESS + corpus.length - 1;
  // Padded by 2: stock-disassemble.ts's `end` form always over-reads by two
  // bytes so the last instruction starting at or before `end` has its full
  // length available, even though this corpus never actually needs those
  // extra bytes (every instruction's own bytes are already fully present).
  const padded = Buffer.concat([corpus, Buffer.alloc(2)]);

  // Independent, decoder-level (not tool-level) proof that the corpus itself
  // really covers all 256 distinct opcode values -- catches an off-by-one in
  // fillerForRoundtrip()'s lengths that would otherwise silently misalign
  // the byte stream.
  const localDecoded = decode(corpus, BASE_ADDRESS);
  assert.equal(localDecoded.length, 256, "Suite A: decoding the corpus locally must yield exactly 256 instructions");
  assert.equal(new Set(localDecoded.map((i) => i.opcode)).size, 256, "Suite A: the corpus must cover exactly 256 distinct opcode values");

  const session = buildRoundtripSession("roundtrip-suite-a", memoryGetReplyFrom(padded, BASE_ADDRESS));
  const deps = buildRoundtripDeps(session);

  // D-13: the answer is capped at 100 instructions per call -- follow
  // nextAddress across pages, exercising the bound as well as the
  // round-trip.
  const listings: string[] = [];
  let address = BASE_ADDRESS;
  for (let page = 0; page < 10; page++) {
    const result = await dispatchStock("vice_disassemble", { address: toHexArg(address), end: toHexArg(corpusEnd) }, deps);
    assert.equal(result.isError, false, `Suite A: vice_disassemble refused at address ${toHexArg(address)}: ${JSON.stringify((result as { content: unknown }).content)}`);
    const answer = JSON.parse((result as { content: { text: string }[] }).content[0]!.text) as {
      listing: string;
      limitReached: boolean;
      nextAddress?: number;
    };
    listings.push(answer.listing);
    if (!answer.limitReached) break;
    assert.ok(answer.nextAddress !== undefined, "Suite A: limitReached === true but nextAddress is absent");
    assert.ok(answer.nextAddress! > address, "Suite A: nextAddress must advance, or the loop never terminates");
    address = answer.nextAddress!;
  }

  const fullSource = listings.join("\n");
  const { ok, bytes, stderr } = assemble(fullSource);
  assert.ok(ok, `Suite A: the tool's own concatenated listing did not assemble through real ACME:\n${stderr}\n---\n${fullSource}`);
  assert.deepEqual(Buffer.from(bytes), Buffer.from(corpus), "Suite A: reassembled bytes must equal the original 256-opcode corpus exactly -- zero exclusions (D-09, criterion 4)");
});

// ---------------------------------------------------------------------------
// Suite B: a realistic fragment -- forward/backward branches, a
// page-crossing branch, the D-11 shrink hazard, the D-10 page-wrap note,
// jsr, and three illegal-but-ACME-expressible opcodes. Exercised directly
// through decode()/render() (Suite A already exercises the dispatchStock()
// path; this suite is about the renderer's specific edge cases).
// ---------------------------------------------------------------------------

test("Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)", { skip: SKIP_REASON }, () => {
  const BASE = 0x20f0; // deliberately near a page boundary so a branch below crosses $20xx -> $21xx
  const bytes = Buffer.from([
    0x90, 0x02, // bcc +2 (forward branch)              @ $20f0-$20f1 -> target $20f4
    0xea, // nop (branch-skip filler)                    @ $20f2
    0xea, // nop (branch-skip filler)                    @ $20f3
    0xb0, 0xfa, // bcs -6 (backward branch to $20f0)     @ $20f4-$20f5 -> target $20f0
    0xd0, 0x0a, // bne +10 (crosses $20xx -> $21xx)       @ $20f6-$20f7 -> target $2102
    0xad, 0x80, 0x00, // lda $0080 (D-11 shrink hazard)  @ $20f8-$20fa
    0x6c, 0xff, 0x10, // jmp ($10ff) (D-10 page-wrap)    @ $20fb-$20fd
    0x20, 0xd2, 0xff, // jsr $ffd2                        @ $20fe-$2100
    0xa7, 0x40, // lax $40 (illegal, ACME-expressible)   @ $2101-$2102
    0xc7, 0x40, // dcp $40 (illegal, ACME-expressible)   @ $2103-$2104
    0x0b, 0x40, // anc #$40 (illegal, ACME-expressible)  @ $2105-$2106
  ]);

  const instructions = decode(bytes, BASE);
  assert.equal(instructions.length, 11, "Suite B: expected exactly 11 decoded instructions");
  assert.ok(instructions.some((i) => i.notes.includes("nmos-page-wrap")), "Suite B: the jmp ($10ff) instruction must carry the D-10 page-wrap note");
  assert.ok(
    instructions.some((i) => i.mode === "absolute" && i.operand?.value === 0x0080),
    "Suite B: the lda $0080 instruction must decode with the D-11 shrink-hazard operand",
  );

  const listing = render(instructions, { origin: BASE });
  assert.match(listing, /lda\+2 \$0080/, "Suite B: the D-11 width force must appear on the lda $0080 line");

  const { ok, bytes: produced, stderr } = assemble(listing);
  assert.ok(ok, `Suite B: the realistic fragment did not assemble through real ACME:\n${stderr}\n---\n${listing}`);
  assert.deepEqual(Buffer.from(produced), Buffer.from(bytes), "Suite B: reassembled bytes must equal the original fragment exactly");
});

// ---------------------------------------------------------------------------
// Suite C: substitution membership, BOTH directions (D-09, criterion 4).
// Driven from OPCODES -- never a hardcoded list.
// ---------------------------------------------------------------------------

/** Minimal operand text for a one-instruction membership probe -- not
 * render()'s own machinery (which never emits a mnemonic for an
 * unassemblable opcode by construction), but a direct, honest probe of
 * whether ACME's assembler, given exactly this mnemonic and this addressing
 * mode, reproduces exactly this opcode byte. */
function membershipOperandText(mode: AddressingMode): string {
  switch (mode) {
    case "implicit":
    case "accumulator":
      return "";
    case "immediate":
      return " #$40";
    case "zeropage":
      return " $40";
    case "zeropage_x":
      return " $40,x";
    case "zeropage_y":
      return " $40,y";
    case "indirect_x":
      return " ($40,x)";
    case "indirect_y":
      return " ($40),y";
    case "indirect":
      return " ($2000)";
    case "relative":
      return " $1010";
    case "absolute":
      return " $2000";
    case "absolute_x":
      return " $2000,x";
    case "absolute_y":
      return " $2000,y";
  }
}

test("Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)", { skip: SKIP_REASON }, () => {
  const overSubstituted: string[] = []; // acmeExpressible: true but NOT byte-faithful
  const underSubstituted: string[] = []; // acmeExpressible: false but IS byte-faithful (should be true)
  const byteSubstitutionSet: number[] = [];

  for (let op = 0; op <= 0xff; op++) {
    const entry = OPCODES[op]!;
    const source = `!cpu 6510\n* = $1000\n${entry.mnemonic}${membershipOperandText(entry.mode)}\n`;
    const { ok, bytes } = assemble(source);
    const byteFaithful = ok && bytes.length > 0 && bytes[0] === op;

    if (entry.acmeExpressible && entry.illegal) {
      // Over-substitution guard: a `true` illegal entry must genuinely
      // reproduce its own opcode byte, or the table is lying about what
      // will round-trip.
      if (!byteFaithful) {
        overSubstituted.push(`$${op.toString(16).padStart(2, "0")} (${entry.mnemonic}/${entry.mode}): assemble ok=${ok}, firstByte=${ok && bytes.length > 0 ? "0x" + bytes[0]!.toString(16) : "n/a"}`);
      }
    }

    if (!entry.acmeExpressible) {
      // Under-substitution guard, corrected to D-09's own stated authority:
      // "the exact set is determined by the assertion test against the
      // installed ACME, not by this list." A `false` entry is CORRECTLY
      // false whenever trusting the bare mnemonic would NOT faithfully
      // reproduce this exact opcode byte -- either because ACME rejects the
      // syntax outright, OR (the case this suite actually found, for
      // several illegal `nop` duplicates and `jam`/`anc`) because ACME
      // accepts the syntax but silently resolves it to a DIFFERENT
      // opcode's canonical byte. Only a `false` entry that IS byte-faithful
      // must be flipped to `true`.
      if (byteFaithful) {
        underSubstituted.push(`$${op.toString(16).padStart(2, "0")} (${entry.mnemonic}/${entry.mode})`);
      } else {
        byteSubstitutionSet.push(op);
      }
    }
  }

  assert.deepEqual(overSubstituted, [], `Suite C (over-substitution): these acmeExpressible:true entries do not faithfully reassemble to their own opcode byte and must be flipped to false:\n${overSubstituted.join("\n")}`);
  assert.deepEqual(underSubstituted, [], `Suite C (under-substitution): these acmeExpressible:false entries ARE byte-faithful and must be flipped to true:\n${underSubstituted.join("\n")}`);

  // Greppable, stable membership-set dump for 04-07's docs/stock-vice-parity.md.
  console.log(
    "DISASM-03 !byte substitution set (acmeExpressible=false, verified against installed ACME):",
    byteSubstitutionSet.map((op) => `$${op.toString(16).padStart(2, "0").toUpperCase()}`).join(", "),
  );
});

// ---------------------------------------------------------------------------
// Suite D: the D-11 size-force spelling.
// ---------------------------------------------------------------------------
//
// The plan's own prediction was that an UNFORCED "lda $0080" would assemble
// to 2 bytes (ACME re-encoding it to zeropage) -- empirically false against
// the real installed ACME 0.97 ("Zem"): a 4-hex-digit literal (which is
// exactly what disasm-renderer.ts's hex4() always emits, for both raw
// literals and substituted-symbol header definitions) ALREADY forces
// word-width addressing on this assembler, independent of the `+2` postfix.
// This suite therefore asserts what is actually true -- the `+2` spelling IS
// understood and DOES produce the correct wide encoding (matching what
// Suites A/B already exercise for $AD) -- and separately demonstrates, with
// an UNPADDED 2-digit literal for the identical value, that the underlying
// shrink hazard the force exists to prevent is real: without SOME safeguard
// (disasm-renderer.ts's own hex4() padding, in this codebase's actual
// mechanism) a value below $0100 WOULD silently shrink. Documented as a
// deviation in 04-06-SUMMARY.md; no correction to disasm-renderer.ts was
// needed -- both of its actual mechanisms (hex4 padding AND the `+2` force)
// independently produce the correct byte-exact result.
test("Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)", { skip: SKIP_REASON }, () => {
  const { ok: forcedOk, bytes: forcedBytes, stderr: forcedStderr } = assemble("!cpu 6510\n* = $1000\nlda+2 $0080\n");
  assert.ok(forcedOk, `Suite D: "lda+2 $0080" failed to assemble:\n${forcedStderr}`);
  assert.deepEqual(Buffer.from(forcedBytes), Buffer.from([0xad, 0x80, 0x00]), 'Suite D: "lda+2 $0080" must assemble to the 3-byte absolute encoding ($AD $80 $00)');

  // The renderer's own rendered form for the same instruction, through the
  // real decode()/render() pipeline -- proves the exact spelling the
  // renderer emits is the one ACME understands, byte-exact.
  const decoded = decode(Buffer.from([0xad, 0x80, 0x00]), 0x1000);
  const listing = render(decoded, { origin: 0x1000 });
  assert.match(listing, /lda\+2 \$0080/, "Suite D: render() must emit the +2 force for an absolute operand below $0100");
  const { ok: renderedOk, bytes: renderedBytes, stderr: renderedStderr } = assemble(listing);
  assert.ok(renderedOk, `Suite D: the renderer's own listing failed to assemble:\n${renderedStderr}\n---\n${listing}`);
  assert.deepEqual(Buffer.from(renderedBytes), Buffer.from([0xad, 0x80, 0x00]), "Suite D: the renderer's own listing must reassemble byte-exact");

  // Non-vacuity proof: demonstrate the shrink hazard is real for the exact
  // same numeric value when written WITHOUT either safeguard (a 2-digit,
  // unpadded literal) -- ACME re-encodes it to zeropage, 2 bytes, a
  // DIFFERENT opcode ($A5, not $AD). This is what disasm-renderer.ts's own
  // hex4() padding (plus the +2 force, belt-and-suspenders) exists to
  // prevent.
  const { ok: hazardOk, bytes: hazardBytes, stderr: hazardStderr } = assemble("!cpu 6510\n* = $1000\nlda $80\n");
  assert.ok(hazardOk, `Suite D (non-vacuity): "lda $80" failed to assemble:\n${hazardStderr}`);
  assert.deepEqual(
    Buffer.from(hazardBytes),
    Buffer.from([0xa5, 0x80]),
    `Suite D (non-vacuity): an UNPADDED 2-digit "lda $80" must shrink to the 2-byte zeropage encoding ($A5 $80) -- proving the shrink hazard this codebase's hex4()+"+2" combination avoids is real, not hypothetical`,
  );
});
