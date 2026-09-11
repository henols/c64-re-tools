# Stock VICE hard losses

As of 2026-09-12, the `barryw/vice-mcp` fork backend has been removed from this
project. Stock VICE's binary monitor, plus its text channel, is now the only
emulator transport this project drives. Three capabilities the fork backend
used to cover have no route on stock at all, and each is a hardware-level fact
rather than an implementation gap — they are recorded here as **permanent
accepted losses**, not hedged ones awaiting a second backend.

This acceptance costs nothing that was actually in use: a prior close-out
audit already recorded, in writing, that the fork's hedge was never exercised
in practice — none of this project's shipped skills needed any of the three
routes below. Removing the fork does not take away a capability a real
workflow relied on; it removes a backend whose only justification was covering
these three gaps, which it was never actually asked to cover.

## SID read-back — ACCEPTED, 2026-09-12

**Status:** Unavailable. Unrecoverable on stock, not merely unimplemented.

**Reason:** SID's $D400-$D418 registers are write-only in hardware, and the
binary monitor exposes no SID read command.

**Affected tool:** `vice_sid_get_state`.

**Alternative:** None for reads. SID writes still work fine over the
memory-set primitive at $D400-$D418 — this is not a hardware loss on the write
side; only reads are write-only in hardware.

## Matrix keyboard — ACCEPTED, 2026-09-12

**Status:** Raw matrix control is unavailable. Text injection remains
available.

**Reason (matrix read/drive):** The binary monitor's KEYBOARD_FEED (0x72)
only injects PETSCII buffer text; the emulator recomputes CIA port B from its
own keyboard array on every read, so there is no wire command that can drive
the raw matrix.

**Reason (chord / press / release):** KEYBOARD_FEED injects a whole string at
a time; it has no primitive for holding multiple keys down together for a
span of frames, and no hold/release primitive for an individual key-down or
key-up event.

**Affected tools:** `vice_keyboard_matrix`, `vice_keyboard_chord`,
`vice_keyboard_key_press`, `vice_keyboard_key_release`.

**Alternative:** `vice_keyboard_type` / `vice_keyboard_petscii` inject text
through the KERNAL keyboard buffer, and `vice_joystick_set` covers most
in-game input — but a program polling $DC00/$DC01 directly will not see
buffer injection.

## RESTORE / NMI — ACCEPTED, 2026-09-12

**Status:** Unavailable. No client-side substitute exists.

**Reason:** RESTORE pulses the NMI line directly; it is not part of the
keyboard matrix, and KEYBOARD_FEED has no way to produce it.

**Affected tool:** `vice_keyboard_restore`.

**Alternative:** `vice_keyboard_type` / `vice_keyboard_petscii` inject text
through the KERNAL keyboard buffer, and `vice_joystick_set` covers most
in-game input — but neither substitutes for an NMI pulse, and a program
polling $DC00/$DC01 directly will not see buffer injection either.

---

All three are now permanent properties of the only backend this project
drives, not gaps a second backend used to cover. A future upstream
`KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor would close the matrix
control half of the second loss for everyone running stock VICE — it would
not, on its own, change the status of SID read-back or RESTORE/NMI, and it
does not reinstate a removed backend.
