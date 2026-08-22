// node:test coverage of disasm-renderer.ts -- D-09's !byte substitution for
// every acmeExpressible:false opcode, D-10's note comments, D-11's width
// invariant, and DISASM-06's substitution gating table. Every fixture is
// built by calling decode() on real opcode bytes -- never a hand-constructed
// Instruction literal -- so a decoder change that breaks the renderer is
// caught here, not silently masked by a stale fixture.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { render, renderLine } from "./disasm-renderer.ts";
import { decode } from "./disasm-decoder.ts";
import { OPCODES, LENGTH_FOR_MODE, type AddressingMode } from "./disasm-opcodes.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Hex helper shared across assertions -- lowercase, `$`-prefixed, 4 digits. */
function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

// ------------------------------------------------- 1. Listing structure

describe("listing structure", () => {
  test("render() starts with !cpu 6510, has exactly one origin line, and one line per instruction", () => {
    const bytes = [0xea, 0xa9, 0x20, 0x60]; // nop, lda #$20, rts
    const instructions = decode(new Uint8Array(bytes), 0x1000);
    const output = render(instructions);
    const lines = output.split("\n");

    assert.equal(lines[0], "!cpu 6510");

    const originLines = lines.filter((line) => line.startsWith("* = $"));
    assert.equal(originLines.length, 1, "expected exactly one origin line");
    assert.equal(originLines[0], `* = ${hex4(instructions[0]!.address)}`);

    const originIndex = lines.indexOf(originLines[0]!);
    const bodyLines = lines.slice(originIndex + 1);
    assert.equal(bodyLines.length, instructions.length);

    // No symbols were substituted (no showSymbols option was passed), so
    // every line between the header and the origin line is empty -- i.e.
    // the origin line directly follows !cpu 6510.
    assert.equal(originIndex, 1);
  });

  test("renderLine() emits no header at all -- just the one instruction line", () => {
    const instructions = decode(new Uint8Array([0x60]), 0x1000); // rts
    const line = renderLine(instructions[0]!);
    assert.equal(line.includes("!cpu"), false);
    assert.equal(line.includes("* ="), false);
    assert.ok(line.includes("rts"));
  });
});

// ------------------------------------------------- 2. D-11 width invariant

describe("D-11: absolute-family width invariant", () => {
  const CASES: Array<{ label: string; opcode: number; mnemonic: string; suffix: string }> = [
    { label: "absolute", opcode: 0xad, mnemonic: "lda", suffix: "" }, // lda absolute
    { label: "absolute_x", opcode: 0xbd, mnemonic: "lda", suffix: ",x" }, // lda absolute,x
    { label: "absolute_y", opcode: 0xb9, mnemonic: "lda", suffix: ",y" }, // lda absolute,y
  ];

  for (const { label, opcode, mnemonic, suffix } of CASES) {
    test(`${label}: operand < $0100 forces +2`, () => {
      const instructions = decode(new Uint8Array([opcode, 0x80, 0x00]), 0x1000); // operand $0080
      const line = renderLine(instructions[0]!);
      assert.ok(line.includes(`${mnemonic}+2 $0080${suffix}`), `line was: ${line}`);
    });

    test(`${label}: operand >= $0100 renders without +2`, () => {
      const instructions = decode(new Uint8Array([opcode, 0x00, 0x10]), 0x1000); // operand $1000
      const line = renderLine(instructions[0]!);
      assert.equal(line.includes("+2"), false, `line was: ${line}`);
      assert.ok(line.includes(`${mnemonic} $1000${suffix}`), `line was: ${line}`);
    });
  }

  test("a substituted symbol whose address is < $0100 also forces +2", () => {
    const instructions = decode(new Uint8Array([0xad, 0xc0, 0x00]), 0x1000); // lda $00c0
    const line = renderLine(instructions[0]!, {
      showSymbols: true,
      symbolFor: (address) => (address === 0x00c0 ? "low_thing" : undefined),
    });
    assert.ok(line.includes("lda+2 low_thing"), `line was: ${line}`);
  });

  test("sweeping: every 3-byte absolute-family opcode with operand $0080 carries the +2 force", () => {
    const ABSOLUTE_FAMILY: AddressingMode[] = ["absolute", "absolute_x", "absolute_y"];
    const stream: number[] = [];
    const expectedCount = OPCODES.filter((entry) => ABSOLUTE_FAMILY.includes(entry.mode)).length;

    for (let op = 0; op <= 0xff; op++) {
      const entry = OPCODES[op]!;
      if (!ABSOLUTE_FAMILY.includes(entry.mode)) continue;
      stream.push(op, 0x80, 0x00); // operand $0080, low byte first
    }

    const instructions = decode(new Uint8Array(stream), 0x1000);
    assert.equal(instructions.length, expectedCount, "sanity: one instruction per absolute-family opcode");

    for (const instr of instructions) {
      assert.ok(ABSOLUTE_FAMILY.includes(instr.mode));
      const line = renderLine(instr);
      // acmeExpressible:false opcodes in this family still get the force
      // inside the comment's mnemonic text, not as real source -- either
      // way, "+2" must appear on the line.
      assert.ok(line.includes("+2"), `opcode $${instr.opcode.toString(16)} (${instr.mnemonic}, ${instr.mode}) missing +2: ${line}`);
    }
  });
});

// ------------------------------------------------- 3. DISASM-06 substitution gating

describe("DISASM-06: substitution gated by operand role and width", () => {
  const FAKE: Record<number, string> = {
    0x0020: "zp_thing",
    0xd020: "vic_cborder",
    0x1007: "loop",
    0x00c0: "low_thing",
  };
  const symbolFor = (address: number): string | undefined => FAKE[address];

  test("lda $d020 (absolute) substitutes, and the header defines vic_cborder", () => {
    const instructions = decode(new Uint8Array([0xad, 0x20, 0xd0]), 0x1000); // lda $d020
    const output = render(instructions, { showSymbols: true, symbolFor });
    assert.ok(output.includes("lda vic_cborder"), output);
    assert.ok(output.includes("vic_cborder = $d020"), output);
  });

  test("lda #$20 (immediate) never substitutes, even though symbolFor(0x20) resolves", () => {
    const instructions = decode(new Uint8Array([0xa9, 0x20]), 0x1000); // lda #$20
    const line = renderLine(instructions[0]!, { showSymbols: true, symbolFor });
    assert.ok(line.includes("lda #$20"), line);
    assert.equal(line.includes("zp_thing"), false, line);
  });

  test("lda $20 (zeropage) never substitutes", () => {
    const instructions = decode(new Uint8Array([0xa5, 0x20]), 0x1000); // lda $20
    const line = renderLine(instructions[0]!, { showSymbols: true, symbolFor });
    assert.ok(line.includes("lda $20"), line);
    assert.equal(line.includes("zp_thing"), false, line);
  });

  test("bcc substitutes on its resolved target, and the header defines loop", () => {
    const instructions = decode(new Uint8Array([0x90, 0x05]), 0x1000); // bcc +5 -> $1007
    assert.equal(instructions[0]!.resolvedTarget, 0x1007);
    const output = render(instructions, { showSymbols: true, symbolFor });
    assert.ok(output.includes("bcc loop"), output);
    assert.ok(output.includes("loop = $1007"), output);
  });

  test("lda $00c0 (absolute, < $0100) substitutes with the +2 force, and the header defines low_thing", () => {
    const instructions = decode(new Uint8Array([0xad, 0xc0, 0x00]), 0x1000); // lda $00c0
    const output = render(instructions, { showSymbols: true, symbolFor });
    assert.ok(output.includes("lda+2 low_thing"), output);
    assert.ok(output.includes("low_thing = $00c0"), output);
  });

  test("jmp ($d020) (indirect) substitutes", () => {
    const instructions = decode(new Uint8Array([0x6c, 0x20, 0xd0]), 0x1000); // jmp ($d020)
    const line = renderLine(instructions[0]!, { showSymbols: true, symbolFor });
    assert.ok(line.includes("jmp (vic_cborder)"), line);
  });

  test("general: every substituted name that appears in the rendered body also has a header definition", () => {
    const bytes = [
      0xad, 0x20, 0xd0, // lda $d020 -> substitutes
      0xa9, 0x20, // lda #$20 -> never substitutes
      0xa5, 0x20, // lda $20 -> never substitutes
      0x90, 0x05, // bcc +5 -> substitutes (resolved target)
      0xad, 0xc0, 0x00, // lda $00c0 -> substitutes, forced
      0x6c, 0x20, 0xd0, // jmp ($d020) -> substitutes
    ];
    const instructions = decode(new Uint8Array(bytes), 0x1000);
    const output = render(instructions, { showSymbols: true, symbolFor });
    const lines = output.split("\n");

    const headerDefinitions = new Set(
      lines.filter((line) => /^\w+ = \$[0-9a-f]{4}$/.test(line)).map((line) => line.split(" = ")[0]!),
    );

    const bodyLines = lines.filter((line) => !line.startsWith("!cpu") && !line.startsWith("* = ") && !/^\w+ = \$[0-9a-f]{4}$/.test(line));
    const bodyText = bodyLines.join("\n");

    for (const name of Object.values(FAKE)) {
      const appearsInBody = new RegExp(`\\b${name}\\b`).test(bodyText);
      if (appearsInBody) {
        assert.ok(headerDefinitions.has(name), `"${name}" appears in the body but has no header definition`);
      }
    }

    // Sanity: this fixture set does exercise at least one substitution, so
    // the loop above is not vacuously true.
    assert.ok(headerDefinitions.size > 0, "expected at least one substitution to have occurred");
    // zp_thing must never appear anywhere -- it is only reachable through
    // immediate/zeropage operands, which never substitute.
    assert.equal(bodyText.includes("zp_thing"), false, bodyText);
  });

  test("showSymbols: false substitutes nothing and emits no definition lines", () => {
    const bytes = [0xad, 0x20, 0xd0, 0x90, 0x05];
    const instructions = decode(new Uint8Array(bytes), 0x1000);
    const output = render(instructions, { showSymbols: false, symbolFor });
    const lines = output.split("\n");
    assert.equal(lines.filter((line) => /^\w+ = \$[0-9a-f]{4}$/.test(line)).length, 0);
    assert.ok(output.includes("lda $d020"));
    // The bcc is the second instruction here (3-byte lda precedes it), so its
    // resolved target is derived from the decoder's own output rather than
    // hardcoded, avoiding an address assumption mismatch.
    assert.ok(output.includes(`bcc ${hex4(instructions[1]!.resolvedTarget!)}`));
  });

  test("symbolFor absent substitutes nothing, even with showSymbols: true", () => {
    const instructions = decode(new Uint8Array([0xad, 0x20, 0xd0]), 0x1000);
    const output = render(instructions, { showSymbols: true });
    assert.ok(output.includes("lda $d020"));
    assert.equal(output.includes("vic_cborder"), false, output);
  });
});

// ------------------------------------------------- 4. D-09 !byte substitution

describe("D-09: every acmeExpressible:false opcode renders as !byte", () => {
  const UNASSEMBLABLE = OPCODES.map((entry, opcode) => ({ opcode, entry })).filter(({ entry }) => entry.acmeExpressible === false);

  test("sanity: at least one unassemblable opcode exists in the table", () => {
    assert.ok(UNASSEMBLABLE.length > 0);
  });

  for (const { opcode, entry } of UNASSEMBLABLE) {
    const hex = `$${opcode.toString(16).padStart(2, "0")}`;

    test(`${hex} (${entry.mnemonic}): renders as !byte with all its bytes and the mnemonic in a comment`, () => {
      // Fill any operand bytes with a value that never collides with a
      // meaningful opcode boundary check -- 0x11 is arbitrary.
      const stream = [opcode];
      for (let i = 1; i < entry.length; i++) stream.push(0x11);

      const instructions = decode(new Uint8Array(stream), 0x1000);
      assert.equal(instructions.length, 1);
      const instr = instructions[0]!;
      assert.equal(instr.acmeExpressible, false);

      const line = renderLine(instr);
      const trimmed = line.trimStart();
      assert.ok(trimmed.startsWith("!byte"), `line did not start with !byte: ${line}`);

      const [bytesPart, commentPart] = line.split(";");
      assert.ok(commentPart, `line has no comment: ${line}`);
      assert.ok(commentPart!.includes(entry.mnemonic), `comment missing mnemonic "${entry.mnemonic}": ${commentPart}`);
      assert.ok(commentPart!.includes("not expressible in ACME"), `comment missing acme-unassemblable text: ${commentPart}`);

      // No mnemonic appears outside the comment -- the source-code part of
      // the line is exactly the !byte directive and its hex list.
      assert.equal(bytesPart!.includes(entry.mnemonic), false, `mnemonic leaked outside the comment: ${bytesPart}`);

      // The emitted byte list equals instr.bytes exactly.
      const hexTokens = bytesPart!
        .replace(/^\s*!byte\s*/, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => Number.parseInt(t.replace("$", ""), 16));
      assert.deepEqual(hexTokens, instr.bytes);
    });
  }
});

// ------------------------------------------------- 5. Address continuity

describe("address continuity across a mixed stream (the reason D-09 emits every byte)", () => {
  test("sum of bytes represented by rendered lines equals the input byte count", () => {
    // nop (expressible, 1 byte), ane #$0f ($8b, acmeExpressible:false, 2
    // bytes), lda #$20 (expressible, 2 bytes), sbc #$xx ($eb,
    // acmeExpressible:false, 2 bytes), rts (expressible, 1 byte).
    const bytes = [0xea, 0x8b, 0x0f, 0xa9, 0x20, 0xeb, 0x33, 0x60];
    const instructions = decode(new Uint8Array(bytes), 0x1000);
    const output = render(instructions);
    const lines = output.split("\n");
    const bodyLines = lines.slice(lines.length - instructions.length);

    assert.equal(bodyLines.length, instructions.length);

    let total = 0;
    for (let i = 0; i < instructions.length; i++) {
      const line = bodyLines[i]!;
      const instr = instructions[i]!;

      if (line.trimStart().startsWith("!byte")) {
        const bytesPart = line.split(";")[0]!.replace(/^\s*!byte\s*/, "");
        const hexTokens = bytesPart.split(",").map((t) => t.trim()).filter(Boolean);
        assert.equal(hexTokens.length, instr.bytes.length, `!byte line ${i} token count disagrees with instr.bytes.length`);
        total += hexTokens.length;
      } else {
        // An expressible, non-truncated line represents exactly its mode's
        // canonical length -- ground truth independent of instr.bytes.
        total += LENGTH_FOR_MODE[instr.mode];
      }
    }

    assert.equal(total, bytes.length, "rendered byte-count total disagrees with the original stream length");
  });
});

// ------------------------------------------------- 6. D-10 note comments

describe("D-10: notes render as trailing comments", () => {
  test("jmp ($12ff) carries the page-wrap text", () => {
    const instructions = decode(new Uint8Array([0x6c, 0xff, 0x12]), 0x1000);
    const line = renderLine(instructions[0]!);
    assert.ok(line.includes("NMOS page-wrap"), line);
  });

  test("a truncated instruction renders as !byte with the truncation text and no mnemonic", () => {
    const instructions = decode(new Uint8Array([0xad, 0x99]), 0x1000); // lda absolute, 2 of 3 bytes
    const instr = instructions[0]!;
    assert.ok(instr.notes.includes("truncated"));
    const line = renderLine(instr);
    assert.ok(line.trimStart().startsWith("!byte"), line);
    assert.ok(line.includes("truncated"), line);
    assert.equal(line.includes(instr.mnemonic), false, `mnemonic "${instr.mnemonic}" leaked into a truncated line: ${line}`);
  });

  test("an illegal-but-expressible opcode (lax $fb) renders the mnemonic normally with 'illegal opcode' in its comment", () => {
    const instructions = decode(new Uint8Array([0xa7, 0xfb]), 0x1000); // lax $fb (zeropage)
    const instr = instructions[0]!;
    assert.equal(instr.mnemonic, "lax");
    assert.equal(instr.illegal, true);
    assert.equal(instr.acmeExpressible, true);
    const line = renderLine(instr);
    assert.equal(line.trimStart().startsWith("!byte"), false, line);
    assert.ok(line.includes("lax $fb"), line);
    assert.ok(line.includes("illegal opcode"), line);
  });
});

// ------------------------------------------------- 7. Purity

describe("purity (D-05: only ./disasm-decoder.ts and/or ./disasm-opcodes.ts, never stock-address.ts)", () => {
  test("disasm-renderer.ts's only from \"...\" specifiers, after stripping comment lines, are drawn from the allowed set", () => {
    const source = readFileSync(join(HERE, "disasm-renderer.ts"), "utf8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    const fromLines = codeOnly
      .split("\n")
      .filter((line) => /\bfrom\s+"/.test(line))
      .map((line) => line.match(/from\s+"([^"]+)"/)?.[1])
      .filter((specifier): specifier is string => specifier !== undefined);

    const specifiers = [...new Set(fromLines)];
    const allowed = new Set(["./disasm-decoder.ts", "./disasm-opcodes.ts"]);

    assert.ok(specifiers.length > 0, "expected at least one import specifier");
    for (const specifier of specifiers) {
      assert.ok(allowed.has(specifier), `unexpected import specifier: ${specifier}`);
    }
    assert.equal(specifiers.includes("./stock-address.ts"), false);
  });
});
