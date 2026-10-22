// The keys of the keyboard matrix that the replay core presses: the key codes
// of chips c64.h, and 11, 12 and 5e of c64run. The play page and the press
// step of a record file use the same codes.

/** The key codes of the keys that have no character of their own. */
export const C64_KEYS = {
  del: 0x01, clr: 0x02, stop: 0x03, leftArrow: 0x04, run: 0x07, csrLeft: 0x08, csrRight: 0x09, csrDown: 0x0a, csrUp: 0x0b,
  home: 0x0c, return: 0x0d, ctrl: 0x0e, cbm: 0x0f, inst: 0x10, leftShift: 0x11, rightShift: 0x12, space: 0x20, upArrow: 0x5e, pound: 0x7e,
} as const;

/** F1 to F8: F2, F4, F6 and F8 press SHIFT with the key. */
export const F_KEYS = [0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8];

/** The keys that a press step names in braces, for example {F1}. */
export const NAMED_KEYS: Readonly<Record<string, number>> = {
  ...Object.fromEntries(F_KEYS.map((key, index) => [`F${index + 1}`, key])),
  RETURN: C64_KEYS.return,
  SPACE: C64_KEYS.space,
  DEL: C64_KEYS.del,
  INST: C64_KEYS.inst,
  HOME: C64_KEYS.home,
  CLR: C64_KEYS.clr,
  STOP: C64_KEYS.stop,
  RUN: C64_KEYS.run,
  CTRL: C64_KEYS.ctrl,
  CBM: C64_KEYS.cbm,
  LSHIFT: C64_KEYS.leftShift,
  RSHIFT: C64_KEYS.rightShift,
  UP: C64_KEYS.csrUp,
  DOWN: C64_KEYS.csrDown,
  LEFT: C64_KEYS.csrLeft,
  RIGHT: C64_KEYS.csrRight,
  POUND: C64_KEYS.pound,
  UPARROW: C64_KEYS.upArrow,
  LEFTARROW: C64_KEYS.leftArrow,
};
