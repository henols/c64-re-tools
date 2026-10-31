// Test helpers for the framed wire: whole messages from stream chunks, for peers that never expect attachments, and frames of any bytes.

import { MessageReader } from "./framing.ts";
import { ProtocolError } from "./messages.ts";

/** Reassembles attachment-free messages. */
export class FrameDecoder {
  readonly #reader = new MessageReader();

  /** Returns every complete message body, parsed as JSON. Throws ProtocolError, also on attachments. */
  push(chunk: Buffer): unknown[] {
    return this.#reader.push(chunk).map(({ message, attachments }) => {
      if (attachments.length > 0) throw new ProtocolError("unexpected attachments");
      return message;
    });
  }
}

/** A frame of these body bytes as they are, with no check: the 4-byte big-endian length, then the body. */
export function rawFrame(body: Buffer | string): Buffer {
  const bytes = Buffer.from(body);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length, 0);
  return Buffer.concat([header, bytes]);
}
