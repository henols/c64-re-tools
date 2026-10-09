// A test reader for the framed wire: whole messages from stream chunks, for peers that never expect attachments.

import { MessageReader, ProtocolError } from "./protocol.ts";

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
