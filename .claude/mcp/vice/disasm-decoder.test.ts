// node:test coverage of disasm-decoder.ts -- DISASM-04 (resolved branch
// targets), DISASM-05 (truncation reported, never fabricated), the
// JMP ($xxFF) NMOS page-wrap note, the opts.end/opts.count boundary rules,
// the all-256 length invariant (criterion 2, same exhaustive ethic as
// disasm-opcodes.test.ts), the never-throws guarantee, and this module's
// own purity constraint (only imports ./disasm-opcodes.ts).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decode, type Instruction } from "./disasm-decoder.ts";
import { OPCODES, LENGTH_FOR_MODE } from "./disasm-opcodes.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------- 1. DISASM-04: branch targets

const BRANCH_OPCODES: Array<{ op: number; mnemonic: string }> = [
  { op: 0x10, mnemonic: "bpl" },
  { op: 0x30, mnemonic: "bmi" },
  { op: 0x50, mnemonic: "bvc" },
  { op: 0x70, mnemonic: "bvs" },
  { op: 0x90, mnemonic: "bcc" },
  { op: 0xb0, mnemonic: "bcs" },
  { op: 0xd0, mnemonic: "bne" },
  { op: 0xf0, mnemonic: "beq" },
];

describe("DISASM-04: branch target resolution (all eight branch opcodes)", () => {
  const CASES: Array<{ label: string; address: number; offset: number; expectedTarget: number }> = [
    { label: "forward +5", address: 0x1000, offset: 0x05, expectedTarget: 0x1007 },
    { label: "backward -5", address: 0x1000, offset: 0xfb, expectedTarget: 0x0ffd },
    { label: "maximum forward +127", address: 0x1000, offset: 0x7f, expectedTarget: 0x1081 },
    { label: "maximum backward -128", address: 0x1000, offset: 0x80, expectedTarget: 0x0f82 },
    { label: "at $fffe, wraps to low memory", address: 0xfffe, offset: 0x05, expectedTarget: 0x0005 },
    { label: "at $0000, wraps to high memory", address: 0x0000, offset: 0xfb, expectedTarget: 0xfffd },
  ];

  for (const { op, mnemonic } of BRANCH_OPCODES) {
    for (const { label, address, offset, expectedTarget } of CASES) {
      test(`$${op.toString(16).padStart(2, "0")} (${mnemonic}): ${label}`, () => {
        const result = decode(new Uint8Array([op, offset]), address);
        assert.equal(result.length, 1);
        const instr = result[0]!;
        assert.equal(instr.mnemonic, mnemonic);
        assert.equal(instr.mode, "relative");
        assert.ok(instr.operand, "operand must be present");
        assert.equal(instr.operand!.role, "relative");
        // The raw byte must remain available, even though the rendered form
        // only needs resolvedTarget.
        assert.equal(instr.operand!.value, offset);
        assert.equal(instr.resolvedTarget, expectedTarget);
      });
    }
  }
});

// ------------------------------------------------- 2. DISASM-05: truncation

describe("DISASM-05: truncation reports a partial instruction, never fabricates", () => {
  test("3-byte instruction with only 1 byte available", () => {
    // $0D = ora absolute, length 3.
    const result = decode(new Uint8Array([0x0d]), 0x1000);
    assert.equal(result.length, 1);
    const instr = result[0]!;
    assert.deepEqual(instr.bytes, [0x0d]);
    assert.equal(instr.operand, undefined);
    assert.equal(instr.resolvedTarget, undefined);
    assert.ok(instr.notes.includes("truncated"));
  });

  test("3-byte instruction with only 2 bytes available", () => {
    const input = [0x0d, 0x42];
    const result = decode(new Uint8Array(input), 0x1000);
    assert.equal(result.length, 1);
    const instr = result[0]!;
    assert.deepEqual(instr.bytes, input);
    assert.equal(instr.operand, undefined);
    assert.equal(instr.resolvedTarget, undefined);
    assert.ok(instr.notes.includes("truncated"));
  });

  test("2-byte instruction with only 1 byte available", () => {
    // $A9 = lda immediate, length 2.
    const result = decode(new Uint8Array([0xa9]), 0x1000);
    assert.equal(result.length, 1);
    const instr = result[0]!;
    assert.deepEqual(instr.bytes, [0xa9]);
    assert.equal(instr.operand, undefined);
    assert.equal(instr.resolvedTarget, undefined);
    assert.ok(instr.notes.includes("truncated"));
  });

  test("no fabricated value anywhere -- every numeric field traces back to the actual input", () => {
    const input = [0xad, 0x99]; // lda absolute ($AD, length 3), only 2 bytes given
    const result = decode(new Uint8Array(input), 0x1000);
    const instr = result[0]!;
    // bytes holds exactly, and only, the bytes that were actually supplied.
    assert.deepEqual(instr.bytes, input);
    // No operand/resolvedTarget object was invented to fill the gap.
    assert.equal("operand" in instr, false);
    assert.equal("resolvedTarget" in instr, false);
    // opcode is drawn from the real first byte, not guessed.
    assert.equal(instr.opcode, input[0]);
  });
});

// ------------------------------------------------- 3. Page-wrap ($6C only)

describe("NMOS JMP ($xxFF) page-wrap note (D-10)", () => {
  const POINTER_HIGH_BYTES = [0x00, 0x12, 0x7f, 0xff];

  for (const hi of POINTER_HIGH_BYTES) {
    test(`$6C with pointer low byte $FF (hi=$${hi.toString(16).padStart(2, "0")}) carries "nmos-page-wrap"`, () => {
      const result = decode(new Uint8Array([0x6c, 0xff, hi]), 0x1000);
      assert.equal(result.length, 1);
      assert.ok(result[0]!.notes.includes("nmos-page-wrap"));
    });
  }

  for (const lo of [0x00, 0x01, 0x7f, 0xfe]) {
    test(`$6C with pointer low byte $${lo.toString(16).padStart(2, "0")} (not $FF) does not carry "nmos-page-wrap"`, () => {
      const result = decode(new Uint8Array([0x6c, lo, 0x10]), 0x1000);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.notes.includes("nmos-page-wrap"), false);
    });
  }

  test("no opcode other than $6C ever emits nmos-page-wrap, across all 256 opcodes", () => {
    const stream: number[] = [];
    for (let op = 0; op <= 0xff; op++) {
      stream.push(op);
      for (let i = 1; i < OPCODES[op]!.length; i++) stream.push(0xff); // worst-case filler
    }
    const result = decode(new Uint8Array(stream), 0x1000);
    const withPageWrap = result.filter((instr) => instr.notes.includes("nmos-page-wrap"));
    for (const instr of withPageWrap) {
      assert.equal(instr.opcode, 0x6c, `unexpected opcode $${instr.opcode.toString(16)} carrying nmos-page-wrap`);
    }
  });
});

// ------------------------------------------------- 4. opts.end drop-past-end

describe("opts.end: drop-past-end rule", () => {
  test("an instruction starting past `end` is absent; one starting at or before `end` is emitted in full", () => {
    // $1000 nop, $1001 nop, $1002 lda absolute ($AD $00 $10) spanning
    // $1002-$1004, $1005 nop.
    const bytes = [0xea, 0xea, 0xad, 0x00, 0x10, 0xea];
    const result = decode(new Uint8Array(bytes), 0x1000, { end: 0x1003 });

    // The lda at $1002 starts at-or-before end(0x1003) -- emitted in full,
    // even though its last byte ($1004) lies past end. The nop at $1005
    // starts past end -- dropped entirely, and the loop stops there.
    assert.equal(result.length, 3);
    assert.equal(result[0]!.mnemonic, "nop");
    assert.equal(result[1]!.mnemonic, "nop");
    const lda = result[2]!;
    assert.equal(lda.mnemonic, "lda");
    assert.equal(lda.address, 0x1002);
    assert.deepEqual(lda.bytes, [0xad, 0x00, 0x10]);
    assert.equal(lda.notes.includes("truncated"), false);
  });

  test("over-read-by-two: two extra bytes past `end` let the last instruction decode in full, not truncated", () => {
    // lda absolute starts exactly AT end -- the two bytes at offsets 3 and 4
    // lie past `end` numerically, but are present in `bytes`, so the
    // instruction is returned complete. This is the roadmap's
    // over-read-by-two rationale in action.
    const bytes = [0xea, 0xea, 0xad, 0x00, 0x10];
    const result = decode(new Uint8Array(bytes), 0x1000, { end: 0x1002 });

    assert.equal(result.length, 3);
    const lda = result[2]!;
    assert.equal(lda.mnemonic, "lda");
    assert.deepEqual(lda.bytes, [0xad, 0x00, 0x10]);
    assert.equal(lda.notes.includes("truncated"), false);
  });
});

// ------------------------------------------------- 5. opts.count

describe("opts.count", () => {
  test("count: 3 over a longer stream returns exactly 3", () => {
    const result = decode(new Uint8Array([0xea, 0xea, 0xea, 0xea, 0xea]), 0x1000, { count: 3 });
    assert.equal(result.length, 3);
  });

  test("count larger than the stream returns what the stream holds; the last one may be truncated", () => {
    // nop, then a truncated lda-absolute (only 2 of 3 bytes available).
    const result = decode(new Uint8Array([0xea, 0xad, 0x00]), 0x1000, { count: 10 });
    assert.equal(result.length, 2);
    assert.equal(result[0]!.mnemonic, "nop");
    assert.equal(result[1]!.mnemonic, "lda");
    assert.ok(result[1]!.notes.includes("truncated"));
  });
});

// ------------------------------------------------- 6. All-256 length invariant

describe("all-256 length invariant (criterion 2)", () => {
  test("a stream of all 256 opcodes, each followed by its own filler, decodes to exactly 256 instructions with matching lengths and addresses", () => {
    const stream: number[] = [];
    for (let op = 0; op <= 0xff; op++) {
      stream.push(op);
      for (let i = 1; i < OPCODES[op]!.length; i++) stream.push(0x00);
    }

    const start = 0x1000;
    const result = decode(new Uint8Array(stream), start);

    assert.equal(result.length, 256);

    let expectedAddress = start;
    for (let op = 0; op <= 0xff; op++) {
      const instr = result[op]!;
      const entry = OPCODES[op]!;
      const hex = `$${op.toString(16).padStart(2, "0")}`;
      // Ground truth is the addressing mode's OWN canonical length
      // (LENGTH_FOR_MODE), deliberately NOT entry.length itself -- this is
      // exactly the desynchronisation criterion 2 warns about ("a wrong
      // length here silently desynchronises every instruction after it").
      // If entry.length ever disagreed with LENGTH_FOR_MODE[entry.mode],
      // this is what would catch it; comparing bytes.length against
      // entry.length would be tautological, since the decoder consumes
      // exactly entry.length bytes by construction.
      const expectedLength = LENGTH_FOR_MODE[entry.mode];
      assert.equal(instr.opcode, op, `instruction ${op} has wrong opcode`);
      assert.equal(instr.bytes.length, expectedLength, `${hex}: byte length disagrees with LENGTH_FOR_MODE[${entry.mode}]`);
      assert.equal(instr.address, expectedAddress & 0xffff, `${hex}: address desynchronised from its predecessors`);
      expectedAddress += expectedLength;
    }
  });
});

// ------------------------------------------------- 7. Never throws

/** Deterministic xorshift32 PRNG -- no Math.random(), so failures reproduce
 * exactly across runs and across machines. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

describe("never throws", () => {
  test("200 deterministic pseudo-random inputs never throw and always return an array", () => {
    const rng = makeRng(0xc0ffee);
    for (let i = 0; i < 200; i++) {
      const length = Math.floor(rng() * 41); // 0..40
      const bytes = new Uint8Array(length);
      for (let j = 0; j < length; j++) bytes[j] = Math.floor(rng() * 256);
      const startAddress = Math.floor(rng() * 0x10000);

      let result: Instruction[] | undefined;
      assert.doesNotThrow(() => {
        result = decode(bytes, startAddress);
      }, `iteration ${i} threw (length=${length}, startAddress=${startAddress})`);
      assert.ok(Array.isArray(result), `iteration ${i} did not return an array`);
    }
  });

  test("decode(undefined as never, 0) returns []", () => {
    assert.deepEqual(decode(undefined as never, 0), []);
  });

  test("decode(new Uint8Array(0), 0) returns []", () => {
    assert.deepEqual(decode(new Uint8Array(0), 0), []);
  });

  test("a negative startAddress returns [] rather than throwing", () => {
    assert.deepEqual(decode(new Uint8Array([0xea]), -1), []);
  });

  test("a non-integer startAddress returns [] rather than throwing", () => {
    assert.deepEqual(decode(new Uint8Array([0xea]), 1.5), []);
  });
});

// ------------------------------------------------- 8. Purity

describe("purity (D-05: this module's only import is ./disasm-opcodes.ts)", () => {
  test("disasm-decoder.ts has exactly one `from \"...\"` specifier once comment lines are stripped", () => {
    const source = readFileSync(join(HERE, "disasm-decoder.ts"), "utf8");
    // Strip `//`-comment lines first -- this module's own header legitimately
    // names `stock-*.ts`/`vice*.ts`/`node:` in its prohibition list, so an
    // unfiltered scan would be a self-invalidating gate.
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    const fromLines = codeOnly
      .split("\n")
      .filter((line) => /\bfrom\s+"/.test(line))
      .map((line) => line.match(/from\s+"([^"]+)"/)?.[1])
      .filter((specifier): specifier is string => specifier !== undefined);

    assert.deepEqual([...new Set(fromLines)], ["./disasm-opcodes.ts"]);
  });
});
