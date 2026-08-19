<!-- GENERATED FILE -- DO NOT EDIT BY HAND. Regenerate with: node scripts/generate-tool-support-table.mjs -->

# VICE MCP tool support by backend

The fork and stock backends deliberately advertise different tool lists. A tool advertised on both backends keeps the same name and a backward-compatible argument shape on either one — stock may add optional parameters but never removes, retypes, or newly-requires one. Calling a tool the active backend does not advertise returns an error naming the reason and the backend that does provide it.

- Total tools: 63
- Available on both backends: 37
- Fork-only: 24
- Stock-only: 2
- Fork manifest generated at: 2026-07-31T15:56:00.302Z
- Stock manifest generated at: 2026-08-14T00:00:00.000Z

Legend: ✅ available, — not available.

| Tool | Fork | Stock | Note |
|------|------|-------|------|
| vice_autostart | ✅ | ✅ |  |
| vice_backtrace | ✅ | — | not yet built (descoped): No shipped skill calls it. |
| vice_checkpoint_add | ✅ | ✅ |  |
| vice_checkpoint_delete | ✅ | ✅ |  |
| vice_checkpoint_group_add | ✅ | — | not yet built (descoped): No shipped skill calls any checkpoint-group tool. |
| vice_checkpoint_group_create | ✅ | — | not yet built (descoped): No shipped skill calls any checkpoint-group tool. |
| vice_checkpoint_group_list | ✅ | — | not yet built (descoped): No shipped skill calls any checkpoint-group tool. |
| vice_checkpoint_group_toggle | ✅ | — | not yet built (descoped): No shipped skill calls any checkpoint-group tool. |
| vice_checkpoint_list | ✅ | ✅ |  |
| vice_checkpoint_set_condition | ✅ | ✅ |  |
| vice_checkpoint_set_ignore_count | ✅ | — | not yet built (descoped): No native wire ignore-count exists; the only implementation would require resuming the machine on every ignored hit, which the no-unrequested-resume policy forbids. CHECKPOINT_INFO's reply still reports an existing ignore count read-only. |
| vice_checkpoint_toggle | ✅ | ✅ |  |
| vice_cia_get_state | ✅ | ✅ |  |
| vice_cia_set_state | ✅ | — | not yet built (descoped): The write half of a tool whose read half already ships on stock; no shipped skill calls the write half. |
| vice_cycles_stopwatch | ✅ | ✅ |  |
| vice_diagnose | ✅ | ✅ |  |
| vice_disassemble | ✅ | ✅ |  |
| vice_disk_attach | ✅ | ✅ |  |
| vice_disk_detach | ✅ | — | not yet built (descoped): No detach opcode exists on the stock binary monitor; attaching a different disk image covers the same workflow. |
| vice_disk_read_sector | ✅ | — | not yet built (descoped): Reading a sector would require parsing the .d64 file client-side rather than calling a live-drive opcode, and no shipped skill calls it. |
| vice_display_get_dimensions | ✅ | — | not yet built (descoped): Descoped alongside vice_display_screenshot -- no shipped skill calls it. |
| vice_display_screenshot | ✅ | — | not yet built (descoped): The client-side PNG encoder for the INDEXED8 framebuffer DISPLAY_GET returns was descoped because no shipped skill calls it. |
| vice_execution_pause | ✅ | ✅ |  |
| vice_execution_run | ✅ | ✅ |  |
| vice_execution_step | ✅ | ✅ |  |
| vice_execution_until_return | — | ✅ | stock-only gain: The fork's custom HTTP API has no equivalent RPC; this is the native EXECUTE_UNTIL_RETURN opcode. |
| vice_joystick_set | ✅ | ✅ |  |
| vice_joystick_tap | ✅ | — | not yet built (descoped): Requires running the machine for a measured hold-then-release interval, which depends on timing infrastructure; not yet built, and no shipped skill calls it. |
| vice_keyboard_chord | ✅ | — | hardware-unrecoverable: KEYBOARD_FEED injects a whole string at a time; it has no primitive for holding multiple keys down together for a span of frames. vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection. |
| vice_keyboard_key_press | ✅ | — | hardware-unrecoverable: KEYBOARD_FEED has no hold/release primitive -- it injects a complete string, not an individual key-down event. vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection. |
| vice_keyboard_key_release | ✅ | — | hardware-unrecoverable: KEYBOARD_FEED has no hold/release primitive -- it injects a complete string, not an individual key-up event. vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection. |
| vice_keyboard_matrix | ✅ | — | hardware-unrecoverable: The binary monitor's KEYBOARD_FEED (0x72) only injects PETSCII buffer text; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix. vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection. |
| vice_keyboard_petscii | ✅ | ✅ |  |
| vice_keyboard_restore | ✅ | — | hardware-unrecoverable: RESTORE pulses the NMI line directly; it is not part of the keyboard matrix, and KEYBOARD_FEED has no way to produce it. vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection. |
| vice_keyboard_type | ✅ | ✅ |  |
| vice_machine_config_get | ✅ | — | not yet built (descoped): Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist subset that never shipped on stock. |
| vice_machine_config_set | ✅ | — | not yet built (descoped): Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist subset that never shipped on stock. |
| vice_machine_reset | ✅ | ✅ |  |
| vice_memory_banks | ✅ | ✅ |  |
| vice_memory_compare | ✅ | ✅ |  |
| vice_memory_fill | ✅ | — | not yet built (descoped): No shipped skill calls it. |
| vice_memory_read | ✅ | ✅ |  |
| vice_memory_search | ✅ | ✅ |  |
| vice_memory_write | ✅ | ✅ |  |
| vice_ping | ✅ | ✅ |  |
| vice_recycle | ✅ | ✅ |  |
| vice_registers_available | — | ✅ | stock-only gain: The fork has no equivalent enumeration call; this is the native REGISTERS_AVAILABLE opcode. |
| vice_registers_get | ✅ | ✅ |  |
| vice_registers_set | ✅ | ✅ |  |
| vice_result_continue | ✅ | ✅ |  |
| vice_run_until | ✅ | ✅ |  |
| vice_sid_get_state | ✅ | — | hardware-unrecoverable: SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes no SID read command. |
| vice_sid_set_state | ✅ | — | not yet built (descoped): SID writes work fine over MEM_SET at $D400-$D418 -- this is not a hardware loss, only reads are write-only in hardware. It is simply not implemented because no shipped skill calls it. |
| vice_snapshot_load | ✅ | ✅ |  |
| vice_snapshot_save | ✅ | ✅ |  |
| vice_sprite_get | ✅ | ✅ |  |
| vice_sprite_inspect | ✅ | ✅ |  |
| vice_sprite_set | ✅ | — | not yet built (descoped): The write half of a tool whose read half already ships on stock; no shipped skill calls the write half. |
| vice_symbols_load | ✅ | ✅ |  |
| vice_symbols_lookup | ✅ | ✅ |  |
| vice_vicii_get_state | ✅ | ✅ |  |
| vice_vicii_set_state | ✅ | — | not yet built (descoped): The write half of a tool whose read half already ships on stock; no shipped skill calls the write half. |
| vice_watch_add | ✅ | ✅ |  |

See `docs/stock-vice-parity.md` for the full narrative reasoning behind every divergence above.
