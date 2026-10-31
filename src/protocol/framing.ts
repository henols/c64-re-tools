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

/** A message that encodeFrame cannot send: its body or its attachments are larger than the limit. */
export class FrameTooLarge extends ProtocolError {
  override name = "FrameTooLarge";
  readonly bytes: number;
  readonly limit: number;

  constructor(what: string, bytes: number, limit: number) {
    super(`${what} of ${bytes} bytes exceed${what === "frame" ? "s" : ""} ${limit}`);
    this.bytes = bytes;
    this.limit = limit;
  }
}

/** Encodes one message and its attachments as one buffer, so writes never interleave. */
export function encodeFrame(message: ClientMessage | HostMessage, attachments: readonly Uint8Array[] = []): Buffer {
  const total = attachments.reduce((sum, attachment) => sum + attachment.length, 0);
  if (total > MAX_ATTACHMENT_BYTES) throw new FrameTooLarge("attachments", total, MAX_ATTACHMENT_BYTES);
  const announced = attachments.length === 0 ? message : { ...message, attachments: attachments.map((attachment) => attachment.length) };
  const body = Buffer.from(JSON.stringify(announced), "utf8");
  if (body.length > MAX_FRAME_BYTES) throw new FrameTooLarge("frame", body.length, MAX_FRAME_BYTES);
  const frames = 1 + attachments.reduce((sum, attachment) => sum + Math.ceil(attachment.length / MAX_FRAME_BYTES), 0);
  const encoded = Buffer.allocUnsafe(frames * HEADER_BYTES + body.length + total);
  let offset = 0;
  const frame = (part: Uint8Array) => {
    offset = encoded.writeUInt32BE(part.length, offset);
    encoded.set(part, offset);
    offset += part.length;
  };
  frame(body);
  for (const attachment of attachments) {
    for (let start = 0; start < attachment.length; start += MAX_FRAME_BYTES) frame(attachment.subarray(start, start + MAX_FRAME_BYTES));
  }
  return encoded;
}

/**
 * The bytes of a stream so far. A decoder joins the chunks only once the bytes
 * of its next step are all here: joining at each chunk copies a large frame
 * again and again.
 */
export class StreamBuffer {
  #chunks: Buffer[] = [];
  length = 0;

  push(chunk: Buffer): void {
    this.#chunks.push(chunk);
    this.length += chunk.length;
  }

  /** All buffered bytes as one buffer. */
  bytes(): Buffer {
    if (this.#chunks.length !== 1) this.#chunks = [Buffer.concat(this.#chunks, this.length)];
    return this.#chunks[0]!;
  }

  /** Drops the first `count` bytes. */
  drop(count: number): void {
    const rest = this.bytes().subarray(count);
    this.#chunks = rest.length === 0 ? [] : [rest];
    this.length = rest.length;
  }
}

/** Splits a stream into frame bodies. After a ProtocolError the decoder is unusable. */
class RawFrameDecoder {
  readonly #stream = new StreamBuffer();
  /** The bytes that the frame in front needs: its header, then its header and body. */
  #needed = HEADER_BYTES;

  push(chunk: Buffer): Buffer[] {
    this.#stream.push(chunk);
    const bodies: Buffer[] = [];
    while (this.#stream.length >= this.#needed) {
      const pending = this.#stream.bytes();
      const length = pending.readUInt32BE(0);
      if (length > MAX_FRAME_BYTES) throw new ProtocolError(`frame of ${length} bytes exceeds ${MAX_FRAME_BYTES}`);
      this.#needed = HEADER_BYTES + length;
      if (pending.length < this.#needed) break;
      bodies.push(Buffer.from(pending.subarray(HEADER_BYTES, HEADER_BYTES + length)));
      this.#stream.drop(HEADER_BYTES + length);
      this.#needed = HEADER_BYTES;
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
