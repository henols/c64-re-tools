// What VICE's two monitors send and read, for the fake monitors of the tests:
// response frames, the split of a command stream, the display body and the
// sentinel answer. It imports nothing, so a test of the wire loads no fake VICE.

/** Builds a binary monitor response frame the way VICE does. */
export function responseFrame(type: number, requestId: number, body: Buffer = Buffer.alloc(0), error = 0): Buffer {
  const header = Buffer.alloc(12);
  header[0] = 0x02;
  header[1] = 0x02;
  header.writeUInt32LE(body.length, 2);
  header[6] = type;
  header[7] = error;
  header.writeUInt32LE(requestId, 8);
  return Buffer.concat([header, body]);
}

/** A socket data listener that splits the binary monitor commands out of the stream and gives each one to `onCommand`. */
export function commandSplitter(onCommand: (requestId: number, command: number, body: Buffer) => void): (chunk: Buffer) => void {
  let pending = Buffer.alloc(0);
  return (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 11) {
      const length = pending.readUInt32LE(2);
      if (pending.length < 11 + length) break;
      const requestId = pending.readUInt32LE(6);
      const command = pending[10]!;
      const body = pending.subarray(11, 11 + length);
      pending = pending.subarray(11 + length);
      onCommand(requestId, command, body);
    }
  };
}

/** A display-get answer body: a width x height raster buffer, 8 bits a pixel, with the 320x200 window at (innerX, innerY). */
export function displayBody(width: number, height: number, innerX: number, innerY: number, fill: (x: number, y: number) => number): Buffer {
  const header = Buffer.alloc(4 + 13 + 4);
  header.writeUInt32LE(13, 0);
  header.writeUInt16LE(width, 4);
  header.writeUInt16LE(height, 6);
  header.writeUInt16LE(innerX, 8);
  header.writeUInt16LE(innerY, 10);
  header.writeUInt16LE(320, 12);
  header.writeUInt16LE(200, 14);
  header[16] = 8;
  header.writeUInt32LE(width * height, 17);
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = fill(x, y);
  return Buffer.concat([header, pixels]);
}

/** The four-line answer VICE gives to `~ $nnnn` (hex is nnnn), then a prompt. */
export function sentinelAnswer(hex: string, prompt = "(C:$e5cf) "): string {
  const value = Number.parseInt(hex, 16);
  const binary = value.toString(2).padStart(16, "0");
  return `+${value}\n$${hex}\n${value.toString(8).padStart(7, "0")}\n%${binary.slice(0, 8)} ${binary.slice(8)}\n${prompt}`;
}
