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
