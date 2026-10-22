// Builds VICE snapshot files (.vsf) for tests: the header of x64sc and the given modules.

import { VSF_SIGNATURE } from "./media.ts";

export interface TestModule {
  name: string;
  major: number;
  minor: number;
  data: Buffer;
}

/** A snapshot file with the header of VICE 3.10 x64sc and these modules. */
export function buildSnapshot(modules: readonly TestModule[]): Buffer {
  const header = Buffer.concat([
    Buffer.from(VSF_SIGNATURE, "latin1"),
    Buffer.from([2, 0]),
    Buffer.from("C64SC".padEnd(16, "\0"), "latin1"),
    Buffer.from("VICE Version\x1a", "latin1"),
    Buffer.from([3, 10, 0, 0, 0, 0, 0, 0]),
  ]);
  return Buffer.concat([
    header,
    ...modules.flatMap((module) => {
      const head = Buffer.alloc(22);
      head.write(module.name, 0, "latin1");
      head[16] = module.major;
      head[17] = module.minor;
      head.writeUInt32LE(22 + module.data.length, 18);
      return [head, module.data];
    }),
  ]);
}

/** The x64sc CPU module MAINC64CPU 1.5 at `clock`, with the NMI state given. */
export function cpuModule(clock: bigint, nmi: { nnmi?: number; pending?: number } = {}): TestModule {
  const data = Buffer.alloc(103);
  data.writeBigUInt64LE(clock, 0);
  data.writeUInt32LE(nmi.nnmi ?? 0, 79);
  data.writeUInt32LE(nmi.pending ?? 0, 83);
  return { name: "MAINC64CPU", major: 1, minor: 5, data };
}

/** The keyboard module KEYBOARD 1.1 with no key down. */
export function keyboardModule(): TestModule {
  return { name: "KEYBOARD", major: 1, minor: 1, data: Buffer.alloc(96) };
}
