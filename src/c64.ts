const ADDRESS_PATTERN = /^\$([0-9a-fA-F]{4})$/;

export type C64Address = number & { readonly __c64Address: unique symbol };

export function c64Address(value: number): C64Address {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`C64 address out of range: ${value}`);
  }
  return value as C64Address;
}

export function parseC64Address(value: string): C64Address {
  const match = ADDRESS_PATTERN.exec(value);
  if (match === null) {
    throw new TypeError(`Invalid C64 address: ${value}`);
  }
  return c64Address(Number.parseInt(match[1]!, 16));
}

export function formatC64Address(value: number): string {
  return `$${c64Address(value).toString(16).padStart(4, "0")}`;
}

/**
 * Converts text to the PETSCII bytes the C64 keyboard types after a reset
 * (upper case/graphics mode). Letters of either case type the unshifted key,
 * which shows as an upper-case letter. "\n" and "\r\n" type RETURN.
 * Throws RangeError naming the first character that has no key.
 */
export function textToPetscii(text: string): Uint8Array {
  const bytes: number[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  for (const character of normalized) {
    const code = character.codePointAt(0)!;
    if (character === "\n" || character === "\r") bytes.push(0x0d);
    else if (code >= 0x61 && code <= 0x7a) bytes.push(code - 0x20);
    else if (code >= 0x20 && code <= 0x5b) bytes.push(code);
    else if (character === "]") bytes.push(0x5d);
    else if (character === "£") bytes.push(0x5c);
    else if (character === "↑" || character === "^") bytes.push(0x5e);
    else if (character === "←") bytes.push(0x5f);
    else throw new RangeError(`There is no C64 key for ${JSON.stringify(character)}`);
  }
  return Uint8Array.from(bytes);
}

/**
 * Shows a CBM file or disk name (PETSCII bytes) as text, the way a directory
 * listing shows it in upper case/graphics mode. Bytes $20-$5f are their
 * characters ($5c is £, $5e is ↑, $5f is ←); every other byte is written as
 * {$xx}, so the text converts back to the same bytes.
 */
export function petsciiNameToText(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    if (byte === 0x5c) text += "£";
    else if (byte === 0x5e) text += "↑";
    else if (byte === 0x5f) text += "←";
    else if (byte >= 0x20 && byte <= 0x5d) text += String.fromCharCode(byte);
    else text += `{$${byte.toString(16).padStart(2, "0")}}`;
  }
  return text;
}

/**
 * The reverse of petsciiNameToText. Letters of either case are the unshifted
 * letters ($41-$5a). Throws RangeError for text that is no name.
 */
export function textToPetsciiName(text: string): Uint8Array {
  const bytes: number[] = [];
  const escape = /^\{\$([0-9a-fA-F]{2})\}/;
  for (let index = 0; index < text.length; ) {
    const escaped = escape.exec(text.slice(index));
    if (escaped !== null) {
      bytes.push(Number.parseInt(escaped[1]!, 16));
      index += escaped[0].length;
      continue;
    }
    const character = text[index]!;
    const code = character.charCodeAt(0);
    if (code >= 0x61 && code <= 0x7a) bytes.push(code - 0x20);
    else if (character === "£") bytes.push(0x5c);
    else if (character === "↑") bytes.push(0x5e);
    else if (character === "←") bytes.push(0x5f);
    else if (code >= 0x20 && code <= 0x5d) bytes.push(code);
    else throw new RangeError(`${JSON.stringify(character)} is not a name character; write other bytes as {$xx}`);
    index++;
  }
  return Uint8Array.from(bytes);
}
