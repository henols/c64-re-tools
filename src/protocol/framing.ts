// The frame codec of the Host Runtime wire: the frame limits, encodeFrame and MessageReader.

import { type ClientMessage, type HostMessage, isInteger, isObject, ProtocolError } from "./messages.ts";

/** Largest frame body either side accepts. */
export const MAX_FRAME_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Framing: 4-byte big-endian body length, then the body. A message body
// is UTF-8 JSON. A message may announce binary attachments with an
// `attachments` array of byte sizes; each attachment then follows as raw
// frames of at most MAX_FRAME_BYTES each, in order.

const HEADER_BYTES = 4;
/** Total attachment bytes one message may carry. */
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

function frame(body: Uint8Array): Buffer {
  const header = Buffer.allocUnsafe(HEADER_BYTES);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

/** Encodes one message and its attachments as one buffer, so writes never interleave. */
export function encodeFrame(message: ClientMessage | HostMessage, attachments: readonly Uint8Array[] = []): Buffer {
  const total = attachments.reduce((sum, attachment) => sum + attachment.length, 0);
  if (total > MAX_ATTACHMENT_BYTES) throw new ProtocolError(`attachments of ${total} bytes exceed ${MAX_ATTACHMENT_BYTES}`);
  const announced = attachments.length === 0 ? message : { ...message, attachments: attachments.map((attachment) => attachment.length) };
  const body = Buffer.from(JSON.stringify(announced), "utf8");
  if (body.length > MAX_FRAME_BYTES) throw new ProtocolError(`frame of ${body.length} bytes exceeds ${MAX_FRAME_BYTES}`);
  const frames = [frame(body)];
  for (const attachment of attachments) {
    for (let offset = 0; offset < attachment.length; offset += MAX_FRAME_BYTES) {
      frames.push(frame(attachment.subarray(offset, offset + MAX_FRAME_BYTES)));
    }
  }
  return Buffer.concat(frames);
}

/** Splits a stream into frame bodies. After a ProtocolError the decoder is unusable. */
class RawFrameDecoder {
  #pending: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.#pending = this.#pending.length === 0 ? chunk : Buffer.concat([this.#pending, chunk]);
    const bodies: Buffer[] = [];
    while (this.#pending.length >= HEADER_BYTES) {
      const length = this.#pending.readUInt32BE(0);
      if (length > MAX_FRAME_BYTES) throw new ProtocolError(`frame of ${length} bytes exceeds ${MAX_FRAME_BYTES}`);
      if (this.#pending.length < HEADER_BYTES + length) break;
      bodies.push(Buffer.from(this.#pending.subarray(HEADER_BYTES, HEADER_BYTES + length)));
      this.#pending = this.#pending.subarray(HEADER_BYTES + length);
    }
    return bodies;
  }
}

export interface ReceivedMessage {
  /** The parsed JSON body, with any `attachments` announcement removed. */
  message: unknown;
  attachments: Buffer[];
}

/** Reassembles messages and their attachments from stream chunks. Throws ProtocolError. */
export class MessageReader {
  readonly #frames = new RawFrameDecoder();
  readonly #textDecoder = new TextDecoder("utf-8", { fatal: true });
  #current: { message: unknown; sizes: number[]; done: Buffer[]; parts: Buffer[]; received: number } | undefined;

  push(chunk: Buffer): ReceivedMessage[] {
    const complete: ReceivedMessage[] = [];
    for (const body of this.#frames.push(chunk)) {
      if (this.#current === undefined) this.#start(body);
      else this.#collect(body);
      const finished = this.#finish();
      if (finished !== undefined) complete.push(finished);
    }
    return complete;
  }

  #start(body: Buffer): void {
    let text: string;
    try {
      text = this.#textDecoder.decode(body);
    } catch {
      throw new ProtocolError("frame body is not valid UTF-8");
    }
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      throw new ProtocolError("frame body is not valid JSON");
    }
    let sizes: number[] = [];
    if (isObject(message) && "attachments" in message) {
      const announced = message.attachments;
      if (!Array.isArray(announced) || !announced.every((size) => isInteger(size, 0, MAX_ATTACHMENT_BYTES))) {
        throw new ProtocolError("attachments must be a list of byte sizes");
      }
      if (announced.reduce((sum: number, size: number) => sum + size, 0) > MAX_ATTACHMENT_BYTES) {
        throw new ProtocolError(`attachments exceed ${MAX_ATTACHMENT_BYTES} bytes`);
      }
      sizes = announced as number[];
      const { attachments: _announced, ...rest } = message;
      message = rest;
    }
    this.#current = { message, sizes, done: [], parts: [], received: 0 };
  }

  #collect(body: Buffer): void {
    const current = this.#current!;
    const expected = current.sizes[current.done.length]!;
    // An attachment of size 0 is complete without a frame, so the pending one needs bytes; an empty frame would only add an empty part.
    if (body.length === 0) throw new ProtocolError("attachment frame is empty");
    if (current.received + body.length > expected) throw new ProtocolError("attachment frame runs past its announced size");
    current.parts.push(body);
    current.received += body.length;
  }

  /** Completes attachments whose bytes are all here; returns the message once nothing is missing. */
  #finish(): ReceivedMessage | undefined {
    const current = this.#current!;
    while (current.done.length < current.sizes.length && current.received === current.sizes[current.done.length]) {
      current.done.push(Buffer.concat(current.parts));
      current.parts = [];
      current.received = 0;
    }
    if (current.done.length < current.sizes.length) return undefined;
    this.#current = undefined;
    return { message: current.message, attachments: current.done };
  }
}
