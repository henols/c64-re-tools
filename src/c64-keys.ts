// The keys of the C64 keyboard matrix and RESTORE. A key is its place in the
// matrix: row * 8 + column, where the row is the line of CIA 1 port A that
// the scan drives low and the column the bit of port B that reads low. The
// press of VICE and of the replay core, and the play page, use these numbers.

/** A press of keys that go down together and up together. `keys` are matrix places, without repeats, in rising order. */
export interface KeyTap {
  keys: number[];
  restore: boolean;
}

/** The keys that a tap holds at most, RESTORE included: the replay core has no more. */
export const MAX_TAP_KEYS = 4;
/** The taps of one press at most. */
export const MAX_PRESS_TAPS = 64;
/** The frames that a tap holds its keys, and then waits with all keys up, when the press gives no frames. */
export const PRESS_FRAMES = 3;
/** The frames of a tap at most: one minute of PAL frames. */
export const MAX_PRESS_FRAMES = 3000;

/** The matrix, row by row (port A line 0 to 7), column 0 to 7 in each row. A name has more than one character. */
const MATRIX = [
  ["DEL", "RETURN", "RIGHT", "F7", "F1", "F3", "F5", "DOWN"],
  ["3", "W", "A", "4", "Z", "S", "E", "LSHIFT"],
  ["5", "R", "D", "6", "C", "F", "T", "X"],
  ["7", "Y", "G", "8", "B", "H", "U", "V"],
  ["9", "I", "J", "0", "M", "K", "O", "N"],
  ["+", "P", "L", "-", ".", ":", "@", ","],
  ["POUND", "*", ";", "HOME", "RSHIFT", "=", "UPARROW", "/"],
  ["1", "LEFTARROW", "CTRL", "2", "SPACE", "CBM", "Q", "STOP"],
];

/** The matrix place of each key. */
export const MATRIX_KEYS: Readonly<Record<string, number>> = Object.fromEntries(MATRIX.flatMap((row, line) => row.map((key, column) => [key, line * 8 + column])));

const LSHIFT = MATRIX_KEYS.LSHIFT!;

/** The names that press a key with the left SHIFT: the second function of the key. */
const SHIFTED_NAMES: Readonly<Record<string, string>> = { F2: "F1", F4: "F3", F6: "F5", F8: "F7", UP: "DOWN", LEFT: "RIGHT", INST: "DEL", CLR: "HOME", RUN: "STOP" };
/** The characters that a key gives with SHIFT. */
const SHIFTED_CHARACTERS: Readonly<Record<string, string>> = { "!": "1", '"': "2", "#": "3", $: "4", "%": "5", "&": "6", "'": "7", "(": "8", ")": "9", "[": ":", "]": ";", "<": ",", ">": ".", "?": "/" };

/** The names in braces, in the order that a refusal lists them. */
export const KEY_NAMES = [
  ...["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"],
  ...["RETURN", "SPACE", "DEL", "INST", "HOME", "CLR", "STOP", "RUN", "RESTORE", "CTRL", "CBM", "LSHIFT", "RSHIFT"],
  ...["UP", "DOWN", "LEFT", "RIGHT", "POUND", "UPARROW", "LEFTARROW"],
];

/** The matrix places of one key: a name, or one character. Undefined when the C64 has no such key. RESTORE has no place: it gives []. */
function placesOf(key: string): number[] | undefined {
  const upper = key.toUpperCase();
  if (upper === "RESTORE") return [];
  if (key === "\n") return [MATRIX_KEYS.RETURN!];
  if (key === " ") return [MATRIX_KEYS.SPACE!];
  const shifted = SHIFTED_NAMES[upper] ?? SHIFTED_CHARACTERS[key];
  if (shifted !== undefined) return [LSHIFT, MATRIX_KEYS[shifted]!];
  // A character is its own key; a name has more than one character.
  const place = key.length === 1 || KEY_NAMES.includes(upper) ? MATRIX_KEYS[upper] : undefined;
  return place === undefined ? undefined : [place];
}

/**
 * The taps of a text, or why it has no taps. Each character is one tap, and
 * a-z press the same keys as A-Z. A key without a character has its name in
 * braces, for example {F1}. Names joined with + in braces are one tap that
 * holds the keys together, for example {LSHIFT+CBM} or {STOP+RESTORE}.
 */
export function keyTaps(text: string): KeyTap[] | string {
  const taps: KeyTap[] = [];
  for (const part of text.replace(/\r\n?/g, "\n").match(/\{[^{}]*\}|[^]/g) ?? []) {
    const keys = part.length > 1 ? part.slice(1, -1).split("+") : [part];
    const places = new Set<number>();
    let restore = false;
    for (const key of keys) {
      const found = key === "" ? undefined : placesOf(key);
      if (found === undefined) {
        if (part.length === 1) return `the C64 keyboard has no key ${JSON.stringify(part)}`;
        return `there is no key ${key === "" ? part : `{${key}}`}. The keys in braces are ${KEY_NAMES.map((name) => `{${name}}`).join(", ")}, and each character key, for example {CTRL+3}. + joins the keys of one tap, for example {LSHIFT+CBM}`;
      }
      if (key.toUpperCase() === "RESTORE") restore = true;
      for (const place of found) places.add(place);
    }
    const count = places.size + (restore ? 1 : 0);
    if (count > MAX_TAP_KEYS) return `${part} holds ${count} keys, and one tap holds at most ${MAX_TAP_KEYS} keys, RESTORE included`;
    taps.push({ keys: [...places].sort((a, b) => a - b), restore });
  }
  if (taps.length === 0) return "give at least one key";
  if (taps.length > MAX_PRESS_TAPS) return `one press has at most ${MAX_PRESS_TAPS} taps. This text has ${taps.length}`;
  return taps;
}

/** The 8 rows of the matrix with `keys` down: bit n of row r is the key at column n. */
export function matrixRows(keys: readonly number[]): number[] {
  const rows = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const key of keys) rows[key >> 3]! |= 1 << (key & 7);
  return rows;
}
