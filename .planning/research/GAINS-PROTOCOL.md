# Stock-VICE binary monitor — protocol detail for the three "gain" capability groups

**Scope:** implementation-ready protocol detail for (A) 1541 drive-CPU debugging via
memspaces, (B) raster-precise checkpoint conditions, (C) full `RESOURCE_GET`/`RESOURCE_SET`
and `PALETTE_GET`.

**Primary source:** local full checkout of `VICE-Team/svn-mirror` at commit **`e50d42c`**
("Merge branch 'clean' into main"), which is `configure.ac` **vice_version 3.10.0**
(`vice/configure.ac:12-14`). All line numbers below refer to that tree under `vice/src/`.
Secondary source: the VICE manual §13 "Binary monitor"
(<https://vice-emu.sourceforge.io/vice_13.html>), used only for the per-command
"Minimum VICE version" annotations.

**Confidence:** HIGH for everything cited to a file+line in the VICE source. Items that
could not be confirmed from source are marked **UNVERIFIED** inline. Nothing here was
tested against a running emulator — the byte layouts are read off the C, and the
`GAINS-PROTOCOL` probe should confirm the three highest-risk items flagged in the
implementation notes.

**Version floor summary** (manual §13, cross-checked against the source):

| Capability | Min VICE | Notes |
|---|---|---|
| memspace byte on `MEM_GET`/`MEM_SET`/`REGISTERS_GET`/`REGISTERS_SET`/`REGISTERS_AVAILABLE` | 3.5 | present since the binary monitor shipped |
| optional memspace byte on `CHECKPOINT_SET` (0x12) | **UNVERIFIED** | manual states no minimum for 0x12; the byte is length-gated (`command->length >= 9`) so it is safe to send to any version — an older server that ignores byte 8 simply creates a main-CPU checkpoint. See A.9. |
| `CONDITION_SET` (0x22) | 3.5 | |
| `RESOURCE_GET`/`RESOURCE_SET` (0x51/0x52) | 3.5 | |
| `VICE_INFO` (0x85) | 3.6 | needed for the version probe itself |
| `PALETTE_GET` (0x91) | 3.6 | |
| `CPUHISTORY_GET` (0x86) | **3.10** | absent on Debian/Ubuntu 3.9 — already a recorded constraint |
| `DISPLAY_GET` (0x84) INDEXED8 | 3.5 command, api_version ≥ 2 | `monitor_binary.c:1247-1250` rejects api < 0x02 |

Everything in A and B therefore works on 3.9 **except** drive-memspace CPU history.
Everything in C works on 3.6+. Resource *names* are not version-stable — see C.5.

---

# A. 1541 drive-CPU debugging via memspaces

## A.1 The wire memspace byte is NOT the internal enum

Two different numberings exist and the difference is the single most likely
first-attempt bug.

Internal enum (`monitor.h:45-53`):

```
e_default_space = 0, e_comp_space = 1, e_disk8_space = 2,
e_disk9_space = 3, e_disk10_space = 4, e_disk11_space = 5, e_invalid_space = 6
```

Wire encoding, translated by `get_requested_memspace()`
(`monitor/monitor_binary.c:401-415`) on the way in and `memspace_to_uint8_t()`
(`monitor/monitor_binary.c:417-434`) on the way out:

| wire byte | memspace | internal enum |
|---:|---|---|
| `0x00` | main CPU (6510) | `e_comp_space` (1) |
| `0x01` | drive unit **8** | `e_disk8_space` (2) |
| `0x02` | drive unit **9** | `e_disk9_space` (3) |
| `0x03` | drive unit **10** | `e_disk10_space` (4) |
| `0x04` | drive unit **11** | `e_disk11_space` (5) |
| any other | → `e_invalid_space` → error `0x02 INVALID_MEMSPACE` | |
| `0xff` (response only) | emitted by `memspace_to_uint8_t` for any unmapped memspace | |

There is **no** wire value for `e_default_space`. The device number (8..11) is *not*
the wire value; `0x08` is rejected with `INVALID_MEMSPACE`.

The manual §13.4.1 documents this same mapping, so it is stable API.

## A.2 Body layouts — offset tables

### `MEM_GET` (0x01) request body — `monitor_binary.c:1631-1696`

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 1 | side effects | `0x00` = peek (uses `mem_bank_peek`), non-zero = read with side effects |
| 1 | 2 | start address | uint16 LE |
| 3 | 2 | end address | uint16 LE, **inclusive** |
| 5 | 1 | **memspace** | per A.1 |
| 6 | 2 | bank id | uint16 LE; ignored for drive memspaces (A.4) |

Minimum body length 8 (`command->length < 8` → `0x80 INVALID_LENGTH`,
`monitor_binary.c:1659-1662`).

**Ordering hazard:** the `startaddress > endaddress` check (line 1653) runs *before* the
length check (line 1659), and `body[0..7]` are dereferenced at lines 1642-1649 before
either. A short body is read out of bounds. Always send exactly 8 bytes.

Response body: uint16 LE length, then that many bytes
(`monitor_binary.c:1685-1691`). `mon_get_mem_block_ex(mem, bank, start, end-start, buf)`
(`monitor.c:919-925`) loops `for (i = 0; i <= end_param; i++)`, i.e. the 4th argument is
a count-minus-one; the net effect is `end - start + 1` bytes, matching the declared
inclusive range.

### `MEM_SET` (0x02) request body — `monitor_binary.c:1699-1757`

Identical 8-byte header, then:

| off | size | field |
|---:|---:|---|
| 0..7 | 8 | same as `MEM_GET` |
| 8 | `end - start + 1` | data bytes |

Minimum body length `8 + length` (line 1725). Writes go through
`mon_set_mem_val_ex(memspace, banknum, addr, byte)`.

### `REGISTERS_GET` (0x31) request body — `monitor_binary.c:797-815`

| off | size | field |
|---:|---:|---|
| 0 | 1 | **memspace** |

Minimum length 1.

Response is the standard `REGISTER_INFO` (0x31) built by
`monitor_binary_response_register_info()` (`monitor_binary.c:467-488`) →
`write_registers()` (`monitor_binary.c:447-465`):

| off | size | field |
|---:|---:|---|
| 0 | 2 | register count, uint16 LE |
| then per register (4 bytes each) | | |
| +0 | 1 | item size = 3 (`MON_REGISTER_ITEM_SIZE`, `monitor_binary.c:437`) |
| +1 | 1 | register id (`REG_ID`, `montypes.h:52-112`) |
| +2 | 2 | value, uint16 LE |

Stride is `item_size + 1`; do not hardcode 4, read the item size byte.

### `REGISTERS_SET` (0x32) request body — `monitor_binary.c:817-864`

| off | size | field |
|---:|---:|---|
| 0 | 1 | **memspace** |
| 1 | 2 | item count, uint16 LE |
| 3 | n×4 | items |

Per item: `+0` item size (1, must be ≥ 3), `+1` register id, `+2` value uint16 LE;
next item at `+ item_size + 1`. Minimum length `3 + count * 4`.
Unknown register id → `0x01 OBJECT_MISSING` (line 852-855). Response is `REGISTER_INFO`
for the same memspace.

### `REGISTERS_AVAILABLE` (0x83) request body — `monitor_binary.c:1103-1181`

| off | size | field |
|---:|---:|---|
| 0 | 1 | **memspace** |

Minimum length 1. Response:

| off | size | field |
|---:|---:|---|
| 0 | 2 | count, uint16 LE |
| then per register | | |
| +0 | 1 | item size = `strlen(name) + 3` |
| +1 | 1 | register id |
| +2 | 1 | register bit size (8 or 16) |
| +3 | 1 | name length |
| +4 | name length | name, ASCII, no NUL |

Stride `item_size + 1`.

### `CHECKPOINT_SET` (0x12) request body — `monitor_binary.c:561-598`

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 2 | start address | uint16 LE |
| 2 | 2 | end address | uint16 LE, inclusive; set equal to start for a single address |
| 4 | 1 | stop when hit | `0` = trace only |
| 5 | 1 | enabled | if `0`, VICE creates it then calls `mon_breakpoint_switch_checkpoint(e_OFF, …)` (line 595) |
| 6 | 1 | operation bitmask | `e_load = 0x01`, `e_store = 0x02`, `e_exec = 0x04` (`montypes.h:117-121`); may be OR'd |
| 7 | 1 | temporary | deletes itself after one hit |
| **8** | **1** | **memspace (OPTIONAL)** | read only when `command->length >= 9` (line 573); otherwise defaults to `e_comp_space` |

Minimum length 8. Send 9 bytes to target a drive.

Response is `CHECKPOINT_INFO` (0x11), built by
`monitor_binary_response_checkpoint_info()` (`monitor_binary.c:510-535`), a fixed
**23-byte** body:

| off | size | field |
|---:|---:|---|
| 0 | 4 | checkpoint number, uint32 LE |
| 4 | 1 | currently hit? (`1` only on the async hit event) |
| 5 | 2 | start address |
| 7 | 2 | end address |
| 9 | 1 | stop when hit |
| 10 | 1 | enabled |
| 11 | 1 | operation bitmask |
| 12 | 1 | temporary |
| 13 | 4 | hit count, uint32 LE |
| 17 | 4 | ignore count, uint32 LE |
| 21 | 1 | has condition? (boolean only — the expression is not retrievable) |
| 22 | 1 | **memspace** (via `memspace_to_uint8_t`, line 531) |

### `CPUHISTORY_GET` (0x86) request body — `monitor_binary.c:1454-1500`

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 1 | **memspace** | filters history entries by originating CPU |
| 1 | 4 | count | read with `little_endian_to_uint32` but assigned to a `uint16_t` (line 1492) → **effectively taken mod 65536**; `0` → `0x81 INVALID_PARAMETER` |

Minimum length 5.

Response body (`monitor_binary.c:1564-1615`):

| off | size | field |
|---:|---:|---|
| 0 | 4 | entry count, uint32 LE |
| then per entry (48 bytes) | | |
| +0 | 1 | item size = **47** (`2 + 8*4 + 8 + 1 + 4`, line 1472) |
| +1 | 2 | register count = **8**, uint16 LE |
| +3 | 32 | 8 × {item size(1)=3, reg id(1), value uint16 LE} |
| +35 | 8 | absolute CPU cycle, **uint64 LE** |
| +43 | 1 | instruction length field = **4** |
| +44 | 1 | opcode |
| +45 | 1 | operand 1 |
| +46 | 1 | operand 2 |
| +47 | 1 | placeholder `0xff` (third operand on other machines) |

The 8 registers are selected from `mon_register_list_get(memspace)` by id
(`monitor_binary.c:1524-1562`): `PC`, `A`, `X`, `Y`, `SP`, `FL`, `LIN`, `CYC`.
`LIN`/`CYC` are forced to `0xffff` in history entries (lines 1583-1588) — history does
not record raster position. Crucially, **exactly 8 of these match in both the 6510 and
6502 register tables**, so the entry layout is byte-identical for main and drive
memspaces. No special-casing needed.

### `BANKS_AVAILABLE` (0x82) — takes no memspace

`monitor_binary_process_banks_available()` (`monitor_binary.c:1045-1101`) hardcodes
`mon_interfaces[e_comp_space]` at lines 1058-1067. There is **no way to enumerate drive
banks** over the binary monitor, and the command body is empty.

## A.3 Does drive debugging need a resource enabled first? Yes — two of them.

There are two separate gates, and the obvious one is not the real one.

**Gate 1 — `check_drive_emu_level_ok()` is a machine-capability check, not a resource
check.** `monitor.c:636-647`:

```c
bool check_drive_emu_level_ok(int drive_num)
{
    if (drive_num < 8 || drive_num > 11) return false;
    if (mon_interfaces[monitor_diskspace_mem(drive_num - 8)] == NULL) {
        mon_out("True drive emulation not supported for this machine.\n");
        return false;
    }
    return true;
}
```

`mon_interfaces[disk_n]` is populated unconditionally at `monitor.c:1665-1667` from the
`drive_interface_init[]` array that `c64/c64.c:1011-1016` fills for all
`NUM_DISK_UNITS` from `drive_cpu_monitor_interface_get()` (`drive/drive.c:576-579`).
**On `x64sc` this check always passes**, regardless of TDE. It gates
`mon_register_get_val`/`set_val` (`mon_register6502.c:93, 146`),
`mon_get_mem_val_ex` (`monitor.c:860-864`) and `mon_set_mem_val_ex` — all of which
return `0` / no-op when it fails.

Consequence: `MEM_GET` and `REGISTERS_GET` on a drive memspace **always succeed** on
`x64sc` and never report an error, even when the drive CPU is not running. You get
stale or reset-state values, silently. There is no protocol-level way to detect this.

**Gate 2 — the drive CPU only actually executes when TDE is on and a drive type is
set.** `drive_enable()` (`drive/drive.c:493-539`):

```c
resources_get_int_sprintf("Drive%uTrueEmulation", &drive_true_emulation, 8 + drv->mynumber);
if (!drive_true_emulation) return 0;
if (drv->type == DRIVE_TYPE_NONE)  return 0;
...
drivecpu_wake_up(drv);
```

So the client must ensure, via `RESOURCE_SET`:

| resource | type | required value | source |
|---|---|---|---|
| `Drive8TrueEmulation` | int | `1` | `drive/drive-resources.c:401-403, 450-452` — name built as `"Drive%iTrueEmulation"`, `i = dnr + 8`; factory default `1`; `RES_EVENT_STRICT` |
| `Drive8Type` | int | non-zero, e.g. `1541` | `drive/drive-resources.c:253-284` — name `"Drive%iType"`; `DRIVE_TYPE_NONE = 0`, `DRIVE_TYPE_1541 = 1541`, `DRIVE_TYPE_1541II = 1542`, `DRIVE_TYPE_1571 = 1571`, `DRIVE_TYPE_1581 = 1581` (`drive/drive.h:108-135`). Unit 8 defaults to the machine default; units 9-11 default to `DRIVE_TYPE_NONE`. |
| `TrapDevice8` | int | `0` recommended | `traps.c:141` — with KERNAL trap loading active the drive CPU never runs the real DOS. **Named `VirtualDevice8` on VICE ≤ 3.9**; renamed in 3.10 with no back-compat alias (`vice/NEWS`: "abandons the confusing name 'virtual device' and replaces it with 'trapdevice'"; a tree-wide grep for `VirtualDevice` in 3.10 finds zero hits). |
| `FileSystemDevice8` | int | `0` | `attach.c:124-127` — `0` none, `1` filesystem, `2` OpenCBM. Set to `0` so the unit is a real drive rather than a host directory. |

The exact resource is `Drive8TrueEmulation` (and `Drive9/10/11TrueEmulation`). A plain
machine-wide **`DriveTrueEmulation` does not exist** in 3.10 — the only occurrence in
the tree is a commented-out line at `drive/drive-snapshot.c:383`. On older VICE the
per-unit name has been in place since the diskunit refactor; **UNVERIFIED** whether 3.9
also uses the per-unit name (very likely yes, since 3.9 already has the
`diskunit_context` model), but the client should probe: `RESOURCE_GET Drive8TrueEmulation`
and fall back to `DriveTrueEmulation` on `0x01 OBJECT_MISSING`.

**Side effect:** setting `Drive8TrueEmulation` from 0 → 1 calls `drivecpu_reset_clk(unit)`
and `drive_enable()` (`drive/drive-resources.c:81-95`), i.e. it **resets the drive CPU**.
Any in-flight drive state is lost. Enable it before starting the operation you want to
observe, not in the middle of one.

## A.4 Bank id for drive memspaces — pass `0x0000` and ignore banks entirely

`drivemem_bank_read`, `drivemem_bank_peek`, `drivemem_bank_store`, `drivemem_bank_poke`
(`drive/drivemem.c:188-213`) all take an `int bank` parameter and **never reference it**.

`mon_banknum_validate()` (`monitor.c:779-796`) returns `-1` for drive memspaces because
`mon_interfaces[disk]->mem_bank_list_nos` is `NULL` (`drive/drivecpu.c:115-116`), and it
also emits `mon_out("Banks not available in this memspace\n")`. `MEM_GET`/`MEM_SET`
only reject on `== 0` (`monitor_binary.c:1672, 1740`), so `-1` passes validation. The
practical result: drive memory access works with any bank value, but every call logs a
line to VICE's console. Send `0x0000`.

`mon_out` does **not** write to the binary socket — it goes to `monitor_network_transmit`
only when `monitor_is_remote()` (the *text* monitor) is true, otherwise to
`uimon_out`/console (`mon_util.c:243-265`). So this noise cannot corrupt the binary
stream. It does cost time and can flood a terminal.

## A.5 Drive registers are a different set — 8 vs 10 entries

`mon_register_list_get6502()` (`mon_register6502.c:270-291`) picks the table by memspace:

```c
if (mem != e_comp_space) { ... mon_reg_list_6502 ... }   /* drives */
else                     { ... mon_reg_list_6510 ... }   /* main CPU */
```

Tables at `mon_register6502.c:56-84`. `ignore_fake_register()`
(`monitor_binary.c:396-399`) drops entries flagged `MON_REGISTER_IS_FLAGS`, so the
`NV-BDIZC` pseudo-entry never appears on the wire.

**memspace `0x00` (main, `mon_reg_list_6510`) — 10 reported registers, in this order:**

| # | name | id | bits |
|---:|---|---:|---:|
| 0 | `PC` | `0x03` | 16 |
| 1 | `A` | `0x00` | 8 |
| 2 | `X` | `0x01` | 8 |
| 3 | `Y` | `0x02` | 8 |
| 4 | `SP` | `0x04` | 8 |
| 5 | `00` | `0x37` (`e_Zero`) | 8 |
| 6 | `01` | `0x38` (`e_One`) | 8 |
| 7 | `FL` | `0x05` | 8 |
| 8 | `LIN` | `0x35` (`e_Rasterline`) | 16 |
| 9 | `CYC` | `0x36` (`e_Cycle`) | 16 |

**memspace `0x01`–`0x04` (drive, `mon_reg_list_6502`) — 8 reported registers:**

| # | name | id | bits |
|---:|---|---:|---:|
| 0 | `PC` | `0x03` | 16 |
| 1 | `A` | `0x00` | 8 |
| 2 | `X` | `0x01` | 8 |
| 3 | `Y` | `0x02` | 8 |
| 4 | `SP` | `0x04` | 8 |
| 5 | `FL` | `0x05` | 8 |
| 6 | `LIN` | `0x35` | 16 |
| 7 | `CYC` | `0x36` | 16 |

`00` and `01` are absent from the drive list by necessity: they carry
`MON_REGISTER_IS_MEMORY` and the list builder resolves them via
`mon_interfaces[mem]->mem_bank_from_name("cpu")` (`mon_register6502.c:277-285`), which is
`NULL` for the drive interface (`drive/drivecpu.c:118`). They are the 6510 I/O port
registers and have no 6502 equivalent anyway.

Register ids are declared stable API: `montypes.h:48-50` — *"These values are used in the
binary monitor API, so it is important that they remain consistent."* The manual §13.3
nonetheless advises resolving names via `REGISTERS_AVAILABLE`; do that once per memspace
at connect time and cache.

**`LIN`/`CYC` on a drive memspace return the MAIN machine's raster position, not
anything drive-related.** `mon_register_get_val()` for `e_Rasterline`/`e_Cycle`
(`mon_register6502.c:117-134`) hardcodes `mon_interfaces[e_comp_space]->get_line_cycle(...)`
regardless of the `mem` argument. (`mon_interfaces[disk]->get_line_cycle` is `NULL` —
`drive/drivecpu.c:119` — so the hardcode is deliberate, not an accident.) These values
are therefore identical across all five memspaces at any instant.

**Writing `LIN`/`CYC` via `REGISTERS_SET` silently fails.** `mon_register_valid()`
returns 1 for them unconditionally (`mon_register.c:59-62`, *"these are not actually
registers, we need them for the conditionals"*), but `mon_register_set_val()`
(`mon_register6502.c:139-176`) has no case for either id and falls through to
`log_error(LOG_DEFAULT, "Unknown register!")`. The client still receives a successful
`REGISTER_INFO` response. Treat `LIN`/`CYC` as read-only in the tool surface.

## A.6 Drive checkpoints: same mechanism, one global stop

Checkpoints are stored per memspace. `breakpoint_add_checkpoint()`
(`mon_breakpoint.c:656-703`) takes the memspace from `addr_memspace(start_addr)` and
appends to `breakpoints[mem]` / `watchpoints_load[mem]` / `watchpoints_store[mem]`
(lines 678-691), then calls `update_checkpoint_state(mem)` (line 692).

`update_checkpoint_state()` (`mon_breakpoint.c:159-183`) sets `monitor_mask[mem]`, calls
`mon_interfaces[mem]->toggle_watchpoints_func(...)` — which is `drivemem_toggle_watchpoints`
(`drive/drivemem.c:125-146`, installed at `drive/drivecpu.c:127`) for drives, swapping in
the watching read/store tables — and arms
`interrupt_monitor_trap_on(mon_interfaces[mem]->int_status)`, i.e. the *drive's* interrupt
status, not the main CPU's. So drive exec breakpoints and load/store watchpoints work
through exactly the same code path as main-CPU ones.

The drive CPU core evaluates them via `6510core.c:503-520`, where `CALLER` is
`cpu->monspace` (`drive/drivecpu.c:442`, set to `monitor_diskspace_mem(drv->mynumber)` at
`drive/drivecpu.c:129`) and `ORIGIN_MEMSPACE` is `drv->mynumber + e_disk8_space`
(`drive/drivecpu.c:391`).

**On hit, the whole emulator stops — not just the drive.** The core calls
`monitor_startup(CALLER)` (`6510core.c:513`), and `monitor_startup()`
(`monitor.c:3371-3430`) enters the monitor loop globally. There is no per-CPU halt.

**The `STOPPED` (0x62) event's PC is always the main CPU's.**
`monitor_binary_response_stopped()` reads
`monitor_cpu_for_memspace[e_comp_space]->mon_register_get_val(e_comp_space, e_PC)`
(`monitor_binary.c:367-372`, and likewise 377, 387 for `RESUMED`/`JAM`) — hardcoded
`e_comp_space`. When a drive breakpoint hits, the 0x62 body tells you nothing about the
drive. Read the drive PC with `REGISTERS_GET memspace=0x01`, or take it from the async
`CHECKPOINT_INFO` (0x11) event whose byte 22 identifies the memspace.

**Timing skew.** The drive CPU is a slave clocked in catch-up chunks from the main CPU:
`drivecpu_execute()` computes `cpu->stop_clk` from the main clock and then runs
`while (*drv->clk_ptr < cpu->stop_clk)` (`drive/drivecpu.c:396-416`). When the machine
stops on a *main-CPU* checkpoint, the drive CPU can be behind by up to a chunk, so drive
registers and drive memory read at that moment are slightly stale relative to the main
CPU. Conversely, stopping on a *drive* checkpoint gives an exact drive-CPU position. If
you need a coherent cross-CPU snapshot, break on the drive side.

**Drive reset preserves checkpoint arming.** `drivecpu_reset()` and
`drivecpu_reset_clk()` save and restore `IK_MONITOR` in `global_pending_int`
(`drive/drivecpu.c:174-190` and `203-213`), so drive breakpoints survive a drive reset —
including the reset caused by toggling `Drive8TrueEmulation`.

**Checkpoint count limit:** `MONITOR_MAX_CHECKPOINTS` is **9** (`monitor.h:208`). It
bounds `watch_load_array[MONITOR_MAX_CHECKPOINTS + 1][NUM_MEMSPACES]`
(`monitor.c:193-194`), the per-instruction queue of triggered watchpoint addresses — not
the number of checkpoints you may create. Checkpoint numbers come from a monotonic
`breakpoint_count` (`mon_breakpoint.c:667`) and are never reused within a session.

## A.7 The `default_memspace` contamination trap — read this before writing stepping code

This is the sharpest hazard in group A and it is not documented in the manual.

`monitor_startup(mem)` sets the monitor's current memspace as a side effect
(`monitor.c:3393-3396`):

```c
if (mem != e_default_space) {
    default_memspace = mem;
}
```

Three binary commands and one parse path depend on `default_memspace`, and **the binary
monitor has no command to set it** (a grep of `monitor_binary.c` finds no assignment to
`default_memspace`):

1. **`ADVANCE_INSTRUCTIONS` (0x71)** → `mon_instructions_step()` / `mon_instructions_next()`
   use `monitor_mask[default_memspace] |= MI_STEP` and
   `interrupt_monitor_trap_on(mon_interfaces[default_memspace]->int_status)`
   (`monitor.c:2603-2617`, `2619-2636`).
2. **`EXECUTE_UNTIL_RETURN` (0x73)** → `mon_instruction_return()`, same pattern
   (`monitor.c:2638-2651`).
3. **`CONDITION_SET` (0x22)** — bare register names in a condition bind to
   `default_memspace` **at parse time**: `register: MON_REGISTER { ... $$ = new_reg(default_memspace, $1); }`
   (`mon_parse.y:854-859`).
4. **`CONDITION_SET` memory operands** — `@bank:addr` resolves the bank via
   `mon_banknum_from_bank(e_default_space, name)` (`mon_parse.y:868, 881`), and
   `mon_banknum_from_bank()` substitutes `default_memspace` for `e_default_space`
   (`monitor.c:687-706`). For a drive memspace `mem_bank_from_name` is `NULL`, so it
   returns `-1`, which the grammar turns into `ERR_ILLEGAL_INPUT` → the whole
   `CONDITION_SET` fails with `0x8f CMD_FAILURE`.

`default_memspace` starts as `e_comp_space` (`monitor.c:1662`). A drive checkpoint hit
sets it to that drive memspace and **nothing sets it back**, because the `PING`-triggered
stop goes `monitor_startup_trap()` → `monitor_trap()` → `monitor_startup(e_default_space)`
(`monitor.c:3447-3457`), which hits the `if (mem != e_default_space)` guard and leaves the
value unchanged.

Net effect after any drive checkpoint hit, for the rest of the session:

- `ADVANCE_INSTRUCTIONS` steps the **drive** CPU, not the main CPU.
- `EXECUTE_UNTIL_RETURN` runs the **drive** CPU to `RTS`.
- New conditions with unqualified `A`/`X`/`PC` refer to the **drive**.
- New conditions using `@cpu:`/`@ram:`/`@io:` **fail outright**.

Two recoveries, both indirect:

1. Create a temporary main-CPU exec checkpoint at the current main PC
   (`CHECKPOINT_SET`, memspace `0x00`, start = end = PC, stop = 1, temporary = 1), then
   `EXIT` (0xaa). The immediate hit calls `monitor_startup(e_comp_space)` and restores
   `default_memspace`. Cheap and reliable.
2. Use the coexisting text remote monitor (enable `MonitorServer`) and send `c:` /
   `device c`. Available because `-binarymonitor` and `-remotemonitor` are independent
   servers, both polled from `monitor_vsync_hook()` (`monitor.c:404-408`).

**Recommendation for the tool surface:** the client should track the memspace of every
checkpoint it creates, treat "a drive checkpoint hit" as a state transition, and either
(a) always execute recovery (1) immediately after a drive hit, or (b) expose stepping as
an explicitly memspace-scoped operation and refuse to step the main CPU while
contaminated. Do not silently step the wrong CPU.

## A.8 Drive CPU history

Drive instructions **are** recorded. `6510core.c:2410` calls
`monitor_cpuhistory_store(..., ORIGIN_MEMSPACE)`, which for the drive core expands to
`drv->mynumber + e_disk8_space` (`drive/drivecpu.c:391`). `mon_cpuhistory_seek()` /
`mon_cpuhistory_next()` (`mon_memmap.c:169-204`, `206-…`) filter on
`cpuhistory[pos].origin` against the five filter arguments, and
`monitor_binary_process_cpuhistory` passes the requested memspace five times
(`monitor_binary.c:1501-1502, 1567-1568`).

So `CPUHISTORY_GET memspace=0x01 count=N` yields the last N drive-8 instructions, with
the same 48-byte entry layout as the main CPU (A.2). Requires **VICE ≥ 3.10**.

Note the ring buffer is shared across memspaces — `mon_cpuhistory_seek` walks backwards
skipping non-matching origins and stops when it laps `cpuhistory_i + 1`
(`mon_memmap.c:186-192`), so requesting N drive entries may return fewer than N if the
main CPU has flooded the buffer since. Always read the returned count.

## A.9 1541 drive memory map (for tool documentation and address validation)

From `memiec_init()` (`drive/iec/memiec.c`, the `DRIVE_TYPE_1540/1541/1541II` case).
Arguments to `drivemem_set_func` are page numbers.

| range | contents |
|---|---|
| `$0000-$00FF` | drive zero page |
| `$0100-$07FF` | drive RAM (2 KB total with zero page) |
| `$1800-$1BFF` | VIA1 (serial/IEC), registers at `$1800-$180F`, mirrored |
| `$1C00-$1FFF` | VIA2 (disk controller), registers at `$1C00-$1C0F`, mirrored |
| `$2000-$27FF` | RAM mirror — or expansion RAM `$2000-$3FFF` if `Drive8RAM2000` = 1 |
| `$3800-$3BFF` / `$3C00-$3FFF` | VIA1 / VIA2 mirrors (only without RAM2000) |
| `$4000-$47FF` | RAM mirror — or expansion RAM `$4000-$5FFF` if `Drive8RAM4000` = 1 |
| `$6000-$67FF` | RAM mirror — or expansion RAM `$6000-$7FFF` if `Drive8RAM6000` = 1 |
| `$8000-$9FFF` | DOS ROM — or expansion RAM if `Drive8RAM8000` = 1 |
| `$A000-$BFFF` | DOS ROM — or expansion RAM if `Drive8RAMA000` = 1 |
| `$C000-$FFFF` | DOS ROM |

`drivemem_ioreg_list_get()` (`drive/drivemem.c:249-269`) names the I/O blocks `VIA1`
(`$1800-$180F`) and `VIA2` (`$1C00-$1C0F`) for the 1541 family.

ROM regions have `NULL` store handlers (`drive_read_rom, NULL, drive_peek_rom`), so
`MEM_SET` into `$C000-$FFFF` on a drive memspace is a no-op — and `drivemem_bank_store`
dereferences `store_func_ptr[addr >> 8]`. **UNVERIFIED** whether the store table entry
for ROM pages is a no-op stub or `NULL`; `drivemem_set_func` is called with `NULL` for
the store function, so a client should treat writes to drive ROM as untested and avoid
them until the probe confirms behaviour.

Side-effect-free reads work on the drive: with `side effects = 0`,
`mon_get_mem_val_ex()` routes to `mem_bank_peek` = `drivemem_bank_peek` →
`peek_func_ptr` (`monitor.c:866-868`, `drive/drivemem.c:196-201`), so VIA registers can
be read without disturbing the disk controller.

## Implementation notes for the client (A)

1. **Define the memspace enum on the wire values, not VICE's internal enum.**
   `type Memspace = 0 | 1 | 2 | 3 | 4` with `0 = main`, `1..4 = units 8..11`. Map from a
   user-facing unit number as `unit - 7`, and reject anything outside 8..11 client-side
   rather than relying on `INVALID_MEMSPACE`.
2. **Always send exactly 8 bytes for `MEM_GET`, 9 for `CHECKPOINT_SET` when a memspace is
   wanted.** The `MEM_GET` handler reads `body[0..7]` before its length check.
3. **Pass bank `0x0000` for drive memspaces** and do not attempt to enumerate their banks
   (`BANKS_AVAILABLE` is main-only). Suppress the "Banks not available" concern — it
   lands on VICE's stdout, not the socket.
4. **Fetch `REGISTERS_AVAILABLE` once per memspace at connect and cache the id→name map.**
   Do not assume 10 registers; drives report 8 and omit `00`/`01`. Parse with
   `stride = item_size + 1`, never a hardcoded 4.
5. **Present `LIN`/`CYC` as machine-global, and read-only.** They are identical on every
   memspace and writes are silently dropped.
6. **Guard drive tools on TDE.** Before the first drive-memspace operation, `RESOURCE_GET`
   `Drive8TrueEmulation` and `Drive8Type`; if TDE is `0` or type is `0`, report the
   precondition rather than returning stale zeros — because VICE will *not* error.
   Setting TDE resets the drive CPU, so surface that as a destructive action.
   Probe both `Drive8TrueEmulation` and `DriveTrueEmulation` and remember which exists.
7. **Handle the `default_memspace` trap explicitly.** Track checkpoint memspaces; after a
   drive-memspace `CHECKPOINT_INFO` hit event (byte 22 ≠ 0), either restore
   `default_memspace` with a temporary main-CPU breakpoint + `EXIT`, or mark stepping and
   `@bank:` conditions as unavailable until restored. Silently stepping the wrong CPU is
   the worst failure mode here.
8. **Do not trust the `STOPPED` PC after a drive hit** — it is always the main CPU's.
   Correlate on `CHECKPOINT_INFO` byte 22 and issue `REGISTERS_GET` for the right memspace.
9. **Gate drive CPU history on VICE ≥ 3.10** from the `VICE_INFO` (0x85) probe. `VICE_INFO`
   response body (`monitor_binary.c:1439-1451`): `[0]=4`, `[1..4] = major, minor, build,
   revision`, `[5]=4`, `[6..9] = uint32 LE SVN revision.
10. **Probe items** (add to the empirical probe rather than guessing): (a) that a 9-byte
    `CHECKPOINT_SET` against VICE 3.9 is accepted rather than rejected on length;
    (b) whether `Drive8TrueEmulation` exists under that name on 3.9;
    (c) `MEM_SET` into drive ROM.

---

# B. Raster-precise checkpoint conditions

## B.1 `CONDITION_SET` (0x22) body layout

`monitor_binary_process_condition_set()` — `monitor_binary.c:665-708`.

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 4 | checkpoint number | uint32 LE; must already exist |
| 4 | 1 | expression length | uint8 → **max 255 bytes** |
| 5 | n | expression | ASCII, **not** NUL-terminated |

Minimum body length `5 + n` (line 678). Response `0x22` with an empty body.

Errors:

- checkpoint not found → `0x01 OBJECT_MISSING` (lines 684-689)
- body too short → `0x80 INVALID_LENGTH`
- expression fails to parse → `0x8f CMD_FAILURE` (line 701-704) with **no detail**.
  The parser's error text goes to `mon_out` (VICE's console), not the socket.

**Conditions attach to an existing checkpoint by number.** They cannot be set at
creation: `CHECKPOINT_SET` (0x12) has no condition field, and the manual §13.4.4 says
explicitly *"To set conditions, see section 13.4.8 Condition set (0x22) after executing
this one."* Two round trips minimum.

**Conditions cannot be read back.** Manual §13.4.8: *"It is not currently possible to
retrieve conditions after setting them."* `CHECKPOINT_INFO` byte 21 is only
`!!checkpt->condition` (`monitor_binary.c:530`). The client must maintain its own
checkpoint-number → expression registry if it wants to report conditions.

**Conditions cannot be cleared.** With length 0, VICE builds `"cond N if (  )"`, which
fails to parse → `0x8f`. To remove a condition, `CHECKPOINT_DELETE` (0x13) and recreate.

**Repeated `CONDITION_SET` on the same checkpoint leaks.**
`mon_breakpoint_set_checkpoint_condition()` (`mon_breakpoint.c:382-399`) assigns
`cp->condition = cnode` without freeing the previous tree. Do not poll-update conditions.

**One-byte overwrite, benign.** `cond[length] = '\0'` (`monitor_binary.c:693`) writes one
past the declared expression into VICE's receive buffer. That buffer is sized
`command_size + 1` (`monitor_binary.c:1826-1830`), so it is safe — but do not rely on
sending extra trailing fields after the expression.

## B.2 What VICE actually executes

The handler does not evaluate the expression itself. It synthesises a text-monitor
command (`monitor_binary.c:667`):

```c
const char* cmd_fmt = "cond %u if ( %s )";
```

and feeds it to `parse_and_execute_line()` (line 701). Therefore:

- **Do not include `if`** — VICE adds it.
- **The expression is already wrapped in one level of parentheses.** Top-level `&&`/`||`
  are fine.
- The expression is parsed by the ordinary text-monitor grammar
  (`mon_parse.y` / `mon_lex.l`), which is what the manual means by *"This is the same
  format used in the text monitor."*
- Parsing happens **at set time**, in the parser's `COND_MODE` lexer state, with
  `default_memspace` and `default_radix` as they are at that moment (see A.7 and B.5).

## B.3 Grammar

From `mon_parse.y:836-892`, with the lexer state entered by the `if` token
(`mon_lex.l:283`: `if { BEGIN (COND_MODE); return IF; }`) and the `COND_MODE` block at
`mon_lex.l:482-568`:

```
cond_expr    : cond_expr COND_OP cond_expr          /* mon_parse.y:839  */
             | L_PAREN cond_expr R_PAREN            /* mon_parse.y:846  */
             | cond_operand                         /* mon_parse.y:850  */
             ;

cond_operand : register                             /* mon_parse.y:854  */
             | number                               /* mon_parse.y:860  */
             | '@' BANKNAME ':' address             /* mon_parse.y:880  */
             | '@' BANKNAME ':' L_PAREN cond_expr R_PAREN   /* mon_parse.y:867 */
             ;

register     : MON_REGISTER                         /* mon_parse.y:854  */
             | memspace MON_REGISTER                /* mon_parse.y:860  */
             ;

memspace     : 'C:' | '8:' | '9:' | '10:' | '11:'   /* mon_lex.l:360-364 */
             ;
```

Operators, all `COND_OP` (`mon_lex.l:483-496`):

| token | meaning | `CONDITIONAL` (`montypes.h:130-145`) |
|---|---|---|
| `*` `/` | multiply, divide (div-by-zero → condition evaluates false + log) | `e_MUL`, `e_DIV` |
| `+` `-` | add, subtract | `e_ADD`, `e_SUB` |
| `<` `<=` `>` `>=` | relational | `e_LT`, `e_LTE`, `e_GT`, `e_GTE` |
| `==` `!=` | equality | `e_EQU`, `e_NEQ` |
| `&` `\|` | bitwise and/or | `e_BINARY_AND`, `e_BINARY_OR` |
| `&&` `\|\|` | logical and/or | `e_LOGICAL_AND`, `e_LOGICAL_OR` |

Not available: `%`, `^`, `<<`, `>>`, unary `!`, unary `~`, unary minus, `?:`.

## B.4 THE gotcha: there is no operator precedence

`mon_parse.y:168` declares a single precedence level:

```
%left<cond_op> COND_OP
```

and `mon_lex.l:458-460` says so outright:

> *"currently no operator precedence is implemented (so all operators have the same
> precedence - ie evaluation is strictly left to right."*

With one left-associative level, `a OP b OP c OP d OP e` parses as
`((((a OP b) OP c) OP d) OP e)`.

So the intuitive raster condition is **silently always false**:

```
RL == $64 && CY == $14
```
parses as `(((RL == $64) && CY) == $14)` → the `&&` yields 0 or 1, compared against 20 → 0.

**Every comparison must be parenthesised.** The correct form is:

```
(RL == $64) && (CY == $14)
```

which VICE wraps to `cond 3 if ( (RL == $64) && (CY == $14) )` and parses as
`((RL == $64) && (CY == $14))`. Correct.

**Client rule: never emit a condition containing more than one operator without explicit
parentheses around each sub-comparison.** If the tool surface accepts a raw expression
from an LLM, it should either require full parenthesisation or refuse expressions with
two or more top-level operators.

## B.5 Number literals are hex by default

`monitor_init()` sets `default_radix = e_hexadecimal` (`monitor.c:1597`), and
`resolve_datatype()` (`mon_parse.y`) short-circuits on that as its very first action:

```c
if (default_radix == e_hexadecimal) {
    return (int)strtol(num, NULL, 16);
}
```

So **every bare integer in a condition is hexadecimal**, whatever the lexer's "guess"
token was. `RL == 100` means raster line `0x100` = 256, not 100.

Prefixes (`mon_lex.l:622-632`):

| prefix | radix | example | value |
|---|---|---|---|
| `$` | hex | `$64` | 100 |
| (none) | hex, via `default_radix` | `64` | 100 |
| `%` | binary | `%01100100` | 100 |
| `&` | octal | `&144` | 100 |
| `+` | decimal | `+100` | 100 |

Note `+` is ambiguous with the addition operator: `\+[0-9]+` (4 chars for `+100`) wins
the longest-match over `\+` (1 char), so `PC + 100` with spaces is addition while
`PC +100` is `PC` followed by decimal 100 → syntax error.

**Client rule: always emit `$hh` / `$hhhh` hexadecimal literals.** Never emit bare or
`+`-prefixed numbers.

## B.6 Raster pseudo-registers: `RL` and `CY`, uppercase only

The condition lexer's names are **not** the names in the register list.

| purpose | `REGISTERS_GET`/`REGISTERS_AVAILABLE` name | condition token | register id |
|---|---|---|---|
| raster line | `LIN` (`mon_register6502.c:66`) | **`RL`** (`mon_lex.l:559`) | `0x35` `e_Rasterline` |
| cycle within line | `CYC` (`mon_register6502.c:67`) | **`CY`** (`mon_lex.l:560`) | `0x36` `e_Cycle` |

**`LIN` and `CYC` are rejected by the condition parser.** The `COND_MODE` block has a
catch-all `[_a-zA-Z0-0]*` → `BANKNAME` at `mon_lex.l:567`. For input `CYC`, flex's
longest-match rule picks that 3-character `BANKNAME` over the 2-character `CY` rule,
and `BANKNAME` is only legal after `@` → syntax error → `0x8f CMD_FAILURE`. Same for
`LIN`.

**Register tokens in `COND_MODE` are UPPERCASE ONLY** (`mon_lex.l:498-560`). There are no
lowercase alternatives in that state (the lowercase table at `mon_lex.l:397-456` is in
the `REG_ASGN` state, used by the `r` register-assignment command). Lowercase `pc` falls
into the `BANKNAME` catch-all → syntax error.

Usable condition register tokens on a C64: `A`, `X`, `Y`, `PC`, `SP`, `FL`, `RL`, `CY`.
(`00`/`01` have no lexer token at all and cannot be referenced in a condition.)

Both pseudo-registers are validated for every memspace: `mon_register_valid()` returns 1
for `e_Rasterline`/`e_Cycle` before it even looks at the register table
(`mon_register.c:59-62`). And evaluation always uses the main machine:
`mon_evaluate_conditional()` calls `mon_interfaces[e_comp_space]->get_line_cycle(...)`
for both (`monitor.c:2773-2783`). So `RL`, `C:RL` and `8:RL` are all the same value —
**every memspace exposes them, and they always mean the main machine's raster position.**
Useful: a drive-memspace checkpoint can be gated on the host's raster line.

## B.7 Value ranges

`machine_get_line_cycle()` for the C64 (`c64/c64.c:1298-1303`):

```c
*line  = (maincpu_clk / machine_timing.cycles_per_line) % machine_timing.screen_lines;
*cycle =  maincpu_clk % machine_timing.cycles_per_line;
*half_cycle = -1;
```

With constants from `c64/c64.h:35-60`:

| `MachineVideoStandard` | cycles/line | screen lines | `RL` range | `CY` range |
|---|---:|---:|---|---|
| PAL (`1`) | 63 | 312 | `0..311` (`$000..$137`) | `0..62` (`$00..$3E`) |
| NTSC (`2`) | 65 | 263 | `0..262` (`$000..$106`) | `0..64` (`$00..$40`) |
| NTSC-old (`3`) | 64 | 262 | `0..261` | `0..63` |
| PAL-N (`4`) | 65 | 312 | `0..311` | `0..64` |

Both are 16-bit register slots, so `REGISTERS_GET` returns them as uint16.
`half_cycle` is always `-1` on the C64 (no half-cycle reporting).

**Important semantic caveat:** these are *derived from the CPU clock*, not read from the
VIC-II's raster counter. There is a fixed phase offset between `RL` and the value a
program reads from `$D012` + `$D011` bit 7. If the requirement is "the raster value the
program will see", use a memory condition on `@io:$d012` instead of `RL`. If the
requirement is "a stable, repeatable point in the frame", `RL`/`CY` are the right tool
and are strictly monotonic within a frame.

This also restates the existing project constraint: `RL`/`CY` wrap every frame and are
not a monotonic cycle counter.

## B.8 Concrete, literal condition strings

All of these are the **expression only** — the bytes to put at offset 5 of the
`CONDITION_SET` body. Do not add `if` and do not add the outer parentheses.

```
(RL == $64) && (CY == $14)
```
Raster line 100 decimal, cycle 20 decimal. **This is the answer to "break at raster line
100, cycle 20".**

```
RL == $64
```
Raster line 100, any cycle.

```
(RL >= $30) && (RL <= $40)
```
Raster lines 48..64 inclusive.

```
(RL == $64) && (CY >= $10) && (CY <= $18)
```
Line 100, cycles 16..24. Left-associative `&&` chaining of parenthesised comparisons is
safe.

```
A == $ff
```
Accumulator equals 255.

```
(A == $ff) && (X != $00)
```

```
(PC >= $c000) && (PC < $d000)
```
`PC` in a condition is special-cased to the *effective* PC of the triggering access
(`monitor.c:2784-2787`: `cnode->value = addr_mask(effective_pc)`), which for a
load/store watchpoint is the PC of the accessing instruction, not the current PC.

```
8:A == $02
```
Drive 8's accumulator. Memspace-qualified registers use the `8:` / `9:` / `10:` / `11:` /
`C:` prefixes (`mon_lex.l:360-364`). This works on a **main-CPU** checkpoint too — you can
break on the main CPU only when the drive is in a particular state.

```
@io:$d012 == $64
```
The VIC-II raster register as the program sees it. Bank names for `x64sc`
(`c64/c64memsc.c:1218-1230`): `default` (0), `cpu` (0), `ram` (1), `rom` (2), `io` (3),
`cart` (4).

```
@ram:$d020 == $00
```
Reads underlying RAM at `$D020` rather than the I/O register.

```
@cpu:(PC) < $80
```
Indirect: the byte at the address in `PC`. This is the exact example in the grammar
comment at `mon_parse.y:866`.

```
(RL == $64) && (@io:$d011 & $80)
```
Line 100 and raster MSB set. Note `&` and `&&` are the same precedence level, but
because each operand is parenthesised this evaluates as
`((RL==$64) && (@io:$d011 & $80))`.

```
(RL == $64) && (8:PC >= $e000)
```
Line 100 while drive 8 is executing in its DOS ROM.

Failing forms, for the client's validator to reject:

| expression | why it fails |
|---|---|
| `RL == $64 && CY == $14` | no precedence — evaluates to `(((RL==$64) && CY) == $14)`, always false (B.4) |
| `LIN == $64` | `LIN` is not a condition token; lexes as `BANKNAME` (B.6) |
| `CYC == $14` | same |
| `rl == $64` | lowercase not in `COND_MODE` (B.6) |
| `RL == 100` | bare literal is hex → 256 (B.5) |
| `if RL == $64` | VICE adds `if` itself (B.2) |
| `RL == $64;` | `;` has no rule in `COND_MODE`; falls to `<*>[^ \t]` and reaches the parser as a raw char → syntax error |
| `@cpu:$d012 == $64` after a drive breakpoint hit | bank resolution uses `default_memspace` (A.7) |

## B.9 Conditions can read memory — with two important properties

`mon_evaluate_conditional()`'s memory branch (`monitor.c:2790-2803`):

```c
} else if (cnode->banknum >= 0) {
    MEMSPACE src_mem = e_comp_space;
    ...
    int old_sidefx = sidefx;
    sidefx = 0;                     /* peek, not read */
    byte1 = mon_get_mem_val_ex(src_mem, cnode->banknum, start);
    sidefx = old_sidefx;
    return byte1;
}
```

1. **`src_mem` is hardcoded `e_comp_space`.** Memory operands in a condition always read
   **main** memory, even on a drive-memspace checkpoint. There is no syntax to read drive
   memory in a condition.
2. **Reads are side-effect free** (`sidefx = 0` → `mem_bank_peek`). Reading `@io:$d019`
   in a condition will not acknowledge the IRQ. This is the behaviour you want.
3. Only **one byte** is read. There is no 16-bit memory operand; compose with
   `(@cpu:$fe) + (@cpu:$ff) * $100` if needed (arithmetic operators are available, and
   with full parenthesisation the left-to-right rule is harmless).

**Bank-name gotcha:** `mon_banknum_from_bank()` (`monitor.c:687-706`) returns `0` — not
an error — for an unrecognised bank name, after logging `"Unknown bank name '%s'"` to
VICE's console. The grammar only rejects negative values (`mon_parse.y:870-872`), so
`@bogus:$d012` **silently becomes bank 0** (`default`/`cpu`). The client should validate
bank names against `BANKS_AVAILABLE` before building the expression.

## B.10 Evaluation cost and ordering

`mon_breakpoint_check_checkpoint()` (`mon_breakpoint.c:468-…`), inner loop:

```c
if (cp && (cp->enabled == e_ON) && mon_is_in_range(cp->start_addr, cp->end_addr, addr)) {
    if (cp->condition) {                                     /* line 544 */
        if (!mon_evaluate_conditional(cp->condition, ...)) continue;
    }
    if (cp->ignore_count) { cp->ignore_count--; continue; }   /* line 549 */
    cp->hit_count++;                                         /* line 556 */
    mon_breakpoint_event(cp);                                 /* line 558 → the 0x11 event */
    if (cp->stop) must_stop = TRUE;
    mon_out(...);                                             /* line 563 */
    ... mon_disassemble_with_regdump(...) ...                 /* lines 583-588 */
}
```

Order matters, and it is favourable:

- **The condition is evaluated before `hit_count`, before `ignore_count`, and before the
  async `CHECKPOINT_INFO` (0x11) event.** So a whole-address-space exec checkpoint
  (`$0000-$FFFF`, op `0x04`) with a raster condition emits at most a handful of 0x11
  events per frame, not one per instruction. This is the correct idiom for
  "break at raster line X" and it refines the warning in
  `.planning/notes/stock-vice-migration-revised-loss-ledger.md`, which concerned a
  full-range checkpoint with **no** condition.
- **`hit_count` only counts condition-passing hits.** That is what makes conditioned
  non-stopping checkpoints usable as counters via `CHECKPOINT_GET` bytes 13-16.

The costs:

- `mon_evaluate_conditional()` walks the expression tree **on every address match**. For
  a full-range exec checkpoint that means every instruction.
- Any enabled breakpoint in a memspace sets `MI_BREAK` and calls
  `interrupt_monitor_trap_on()` (`mon_breakpoint.c:173-182`), which forces the CPU core
  through the `DO_INTERRUPT` monitor path every instruction (`6510core.c:503-520`).
- Non-stopping hits still run `mon_out()` and `mon_disassemble_with_regdump()`
  (`mon_breakpoint.c:563-588`) — the disassembly branch is
  `else if (!is_loadstore || cp->stop)`, which is *always* true for exec checkpoints. This
  is real per-hit work. It goes to VICE's console (`mon_util.c:243-265`), not the socket,
  so it cannot corrupt the protocol stream — but it is slow and floods the terminal.
- `search_checkpoint_list()` (`mon_breakpoint.c:414-436`) is a linear list walk despite
  the "sorted, can drop out early" comment — it never breaks early.

Practical guidance: narrow the address range whenever the target address is known
(`(RL == $64)` on a single known address is cheap); reserve the full-range form for
"stop the machine at raster X regardless of what it's doing", and expect a large
slowdown while it is armed. Delete or disable the checkpoint as soon as it has fired.

**Range semantics:** `mon_is_in_range()` (`monitor.c:512-529`) supports wrap-around —
if `end < start` the test is `(loc >= start) || (loc <= end)`. `$0000-$FFFF` is a normal
non-wrapping full range and works.

**Maximum expression length is 255** (the uint8 length field). The parser itself imposes
no additional limit — the buffer is created from the synthesised string with
`yy_scan_buffer` (`mon_lex.l:free_buffer`/`make_buffer`). Budget for the wrapper:
`"cond " + digits + " if ( " + expr + " )"`.

## Implementation notes for the client (B)

1. **Build conditions through a small typed AST, not string concatenation from LLM
   input.** Emit fully parenthesised comparisons, `$hh` hex literals, and uppercase
   register tokens. This one decision eliminates B.4, B.5 and B.6 simultaneously.
2. **Provide `RL`/`CY` under the tool-facing names the rest of the surface uses
   (`LIN`/`CYC` or `raster_line`/`raster_cycle`) and translate at the boundary.** Never
   pass the register-list name into a condition.
3. **Two-step checkpoint creation.** `CHECKPOINT_SET` → read the checkpoint number from
   the 0x11 response bytes 0-3 → `CONDITION_SET`. If `CONDITION_SET` fails, delete the
   orphan checkpoint before returning an error, or you leave an unconditioned
   full-range breakpoint armed — which will halt the machine on the next instruction.
4. **Keep a client-side condition registry** keyed on checkpoint number, since VICE
   cannot report conditions back. Surface it in whatever tool lists checkpoints.
5. **Treat conditions as immutable.** To change one, delete and recreate the checkpoint —
   both because `CONDITION_SET` cannot clear and because re-setting leaks.
6. **Validate ranges client-side against the machine's video standard.** `RESOURCE_GET
   MachineVideoStandard` (1 PAL / 2 NTSC / 3 NTSC-old / 4 PAL-N, `machine.h:57-60`) and
   reject `RL`/`CY` values out of range from B.7 — VICE will happily accept a condition
   that can never be true.
7. **Validate bank names against `BANKS_AVAILABLE` (0x82)** before emitting `@bank:`,
   because an unknown name silently becomes bank 0.
8. **Document the cost.** A raster breakpoint is a whole-address-space exec checkpoint;
   the tool should say so, auto-delete it after the hit, and consider raising `Speed` /
   noting the slowdown.
9. **`CONDITION_SET` failure gives you no diagnostic.** Since `0x8f` is all you get,
   the client's own validator is the only source of useful error messages. Invest in it.
10. **Probe items:** confirm that `(RL == $64) && (CY == $14)` actually fires on a real
    build, and confirm the phase relationship between `RL` and `$D012` so the tool
    documentation can state it.

---

# C. `RESOURCE_GET` / `RESOURCE_SET` (0x51 / 0x52) and `PALETTE_GET` (0x91)

## C.1 `RESOURCE_GET` (0x51)

`monitor_binary_process_resource_get()` — `monitor_binary.c:920-970`.

**Request body:**

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 1 | resource name length | must be ≥ 1 |
| 1 | n | resource name | ASCII, not NUL-terminated |

Minimum body length `1 + n`.

**Bug to route around:** the length check calls `monitor_binary_error(...)` but does
**not** `return` (`monitor_binary.c:931-935`). A malformed request produces an error
response *and then* a normal (or garbage) response. A demultiplexer keyed on request id
will see two replies for one id. Always send a well-formed body; and make the client's
request table tolerant of a duplicate reply rather than throwing.

VICE also writes `resource_name[resource_name_length] = '\0'` (line 938) one byte past
the name, into its own receive buffer — safe (buffer is `command_size + 1`), but do not
append significant bytes after the name.

**Response body** — the type is a leading discriminator byte:

*String resource* (`monitor_binary.c:942-950`):

| off | size | field |
|---:|---:|---|
| 0 | 1 | `0x00` = `e_MON_RESOURCE_TYPE_STRING` (`monitor_binary.c:198`) |
| 1 | 1 | string length |
| 2 | n | string bytes, no NUL |

Total `2 + strlen`.

*Integer resource* (`monitor_binary.c:951-960`):

| off | size | field |
|---:|---:|---|
| 0 | 1 | `0x01` = `e_MON_RESOURCE_TYPE_INT` |
| 1 | 1 | value byte count, always `4` |
| 2 | 4 | value, uint32 LE |

Total `6`.

Note the type codes `0x00`/`0x01` are the *wire* codes, which happen to be the inverse
sense of VICE's internal `resource_type_t` (`resources.h:33-36`: `RES_INTEGER = 0`,
`RES_STRING = 1`). Use the wire codes.

**Interpret the integer as signed int32.** VICE stores resources as C `int` and
`write_uint32(int_value, ...)` reinterprets the bits. `Speed` legitimately takes negative
values (negative = target FPS, `vsync.c:149`), so a client that treats the field as
unsigned will misreport it.

**Errors:**

| condition | error |
|---|---|
| resource does not exist (`resources_query_type` returns `-1`) | `0x01 OBJECT_MISSING` (default branch, line 961-963) |
| string resource whose current value is `NULL` | `0x01 OBJECT_MISSING` (line 944-947) |
| string resource longer than 255 bytes | `0x01 OBJECT_MISSING` (same check) |
| integer resource read fails | `0x01 OBJECT_MISSING` (line 952-955) |

**"Unset string" and "no such resource" are therefore indistinguishable.** Several real
resources default to `NULL` — e.g. `AutostartPrgDiskImage` (`autostart.c:382`). The
client must not conclude "resource does not exist" from `0x01` alone. Maintain a
known-names allow-list, or probe with `RESOURCE_SET` (which reports differently).

## C.2 `RESOURCE_SET` (0x52)

`monitor_binary_process_resource_set()` — `monitor_binary.c:972-1030`.

**Request body:**

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 1 | value type | `0x00` string, `0x01` int; anything else → `0x81 INVALID_PARAMETER` |
| 1 | 1 | resource name length | must be ≥ 1 |
| 2 | n | resource name | ASCII |
| `2+n` | 1 | value length | must be ≥ 1 |
| `3+n` | m | value bytes | |

Minimum body length `2 + n + 1 + m` (`monitor_binary.c:981-985`).

**Response body is empty.**

Semantics per type:

*Type `0x01` (int)* — `monitor_binary.c:1002-1021`:

| value length | interpretation |
|---:|---|
| 1 | `(uint8_t)*value` — **unsigned**, 0..255 |
| 2 | `little_endian_to_uint16` — unsigned, 0..65535 |
| 4 | `little_endian_to_uint32` assigned to `int` — full signed int32 range |
| anything else | `0x80 INVALID_LENGTH` |

then `resources_set_int(name, value)`.

*Type `0x00` (string)* — `monitor_binary.c:989-1001`. Works for **both** string and
integer resources, via `resources_set_value_string()`
(`resources.c:resources_set_value_string`):

```c
case RES_INTEGER: {
    int_value = (int)strtol(value, &endptr, 0);
    if (*endptr == '\0') status = (*r->set_func_int)(int_value, r->param);
    else                 status = -1;
}
case RES_STRING:  status = (*r->set_func_string)(value, r->param);
```

**`strtol(..., 0)` is base-detecting.** `"26"` → 26, `"0x1a"` → 26, `"026"` → **22**
(octal). Any trailing garbage → failure. A generic "set resource from a string" tool
that ever emits a zero-padded decimal will silently set the wrong value.

**Client rule: use type `0x01` with a **4-byte** LE value for every integer resource, and
type `0x00` only for genuine string resources.** The 4-byte form is the only one that can
express negative values, and it sidesteps the base-0 trap entirely.

**Value length 0 is rejected.** You cannot set a string resource to the empty string over
the binary monitor. Setting a filename-type resource back to "none" is not possible this
way.

**Errors:**

| condition | error |
|---|---|
| bad value type byte | `0x81 INVALID_PARAMETER` |
| name length 0, value length 0, or short body | `0x80 INVALID_LENGTH` |
| string type, resource does not exist | `0x01 OBJECT_MISSING` (default branch of `resources_query_type`) |
| string type, `resources_set_value_string` returns < 0 (unknown resource, unparsable int, setter rejected) | `0x8f CMD_FAILURE` |
| int type, `resources_set_int` returns < 0 (unknown resource, or setter rejected the value) | `0x8f CMD_FAILURE` |

On the int path, **"no such resource" and "invalid value" both yield `0x8f`** — VICE only
logs the distinction (`resources.c`: `log_warning("Trying to assign value to unknown resource '%s'")`).
Use `RESOURCE_GET` first if you need to distinguish.

One more `0x8f` source worth knowing: `resources_set_int()` returns `-2` for resources
tagged `RES_EVENT_STRICT` while netplay is not idle, and records-instead-of-sets for
`RES_EVENT_SAME` while netplay is connected. `Drive8TrueEmulation`, `FileSystemDevice8`,
`BinaryMonitorServer` and `InitialWarpMode` are all `RES_EVENT_STRICT`. Irrelevant unless
someone enabled netplay, but it explains an otherwise inexplicable failure.

## C.3 Resource names relevant to C64 reverse engineering

All names verified in the 3.10 source. Where the name is generated at runtime the format
string and its site are given, so the pattern is auditable.

### True drive emulation and drives

| resource | type | values | source |
|---|---|---|---|
| `Drive8TrueEmulation` … `Drive11TrueEmulation` | int | 0/1, factory 1 | `drive/drive-resources.c:401-403`, name at `:450` (`"Drive%iTrueEmulation"`, `i = dnr+8`) |
| `Drive8Type` … `Drive11Type` | int | 0 = none, 1541, 1542 (=1541-II), 1551, 1570, 1571, 1581, 2000, 4000 | `drive/drive-resources.c:253-284` (`"Drive%iType"`); constants `drive/drive.h:108-135` |
| `Drive8IdleMethod` | int | 0 skip-cycles, 1 trap-idle, 2 frame-idle, 3 no-idle | `drive/drive-resources.c:391-392`, name `:437` |
| `Drive8RPM` | int | ~30000 (hundredths of RPM) | `drive/drive-resources.c:441` |
| `Drive8WobbleFrequency`, `Drive8WobbleAmplitude` | int | | `drive/drive-resources.c:443-447` |
| `Drive8ExtendImagePolicy` | int | | `drive/drive-resources.c:433` |
| `Drive8RTCSave` | int | 0/1 | `drive/drive-resources.c:407`, name `:459` |
| `Drive8RAM2000`, `Drive8RAM4000`, `Drive8RAM6000`, `Drive8RAM8000`, `Drive8RAMA000` | int | 0/1 | `drive/iec/iec-resources.c:367-…` |
| `DriveSoundEmulation` | int | 0/1, factory 0 | `drive/drive-resources.c:384` |
| `DriveSoundEmulationVolume` | int | factory 1000 | `drive/drive-resources.c:386` |
| `FileSystemDevice8` … `11` | int | 0 none, 1 filesystem, 2 OpenCBM | `attach.c:124-139` |
| `AttachDevice8d0Readonly` (and `d1`, units 9-11) | int | 0/1 | `attach.c:~110-122` |
| `TrapDevice8` … `TrapDevice11` (also `1`, `2`, `4`-`7`) | int | 0/1, factory 0 | `traps.c:141-147` — **`VirtualDevice8` on VICE ≤ 3.9** |

### SID

| resource | type | values | source |
|---|---|---|---|
| `SidEngine` | int | 0 FastSID, 1 ReSID, 2 CatweaselMKIII, 3 HardSID, 4 ParSID, 7 USBSID, 8 ReSIDfp; **99 = default** | `sid/sid-resources.c:577-588`; constants `sid/sid.h:43-53` |
| `SidModel` | int | 0 6581, 1 8580, 2 8580D, 3 DTVSID; **99 = default** | `sid/sid-resources.c:594`; constants `sid/sid.h:87-93` |
| `SidFilters` | int | 0/1, factory 1 | `sid/sid-resources.c:590` |
| `SidResidSampling` | int | resampling by default | `sid/sid-resources.c:536` |
| `SidStereo` | int | 0..7 extra SIDs | `sid/sid-resources.c:626` |
| `Sid2AddressStart` … `Sid8AddressStart` | int | e.g. `0xde00` | `c64/c64-resources.c:461-475` |

`SID_ENGINE_DEFAULT`/`SID_MODEL_DEFAULT` are both **99**, and the setters translate them
to a build-dependent concrete value (`set_sid_engine`, `set_sid_model`). A `RESOURCE_GET`
will therefore never return 99 — it returns the resolved value.

### VIC-II and video

Chip-prefixed resources are built as `util_concat(chipname, suffix)` where `chipname` is
`"VICII"` (`viciisc/vicii-resources.c:194`: `raster_resources_chip_init("VICII", ...)`).

| resource | type | values | source |
|---|---|---|---|
| `VICIIModel` | int | 0 6569, 1 8565, 2 6569R1, 3 6567, 4 8562, 5 6567R56A, 6 6572 | `viciisc/vicii-resources.c:171-176`; constants `vicii.h:59-71`. **DANGEROUS — C.4** |
| `VICIIBorderMode` | int | 0 normal, 1 full, 2 debug, 3 none | `viciisc/vicii-resources.c:154`; constants `vicii.h:44-47` |
| `VICIICheckSsColl`, `VICIICheckSbColl` | int | 0/1, factory 1 | `viciisc/vicii-resources.c:156-162` |
| `VICIIVSPBug` | int | 0/1, factory 0 | `viciisc/vicii-resources.c:165` |
| `VICIIFilter` | int | 0 none, 1 CRT, 2 Scale2x | `video/video-resources.c:1067-1078`; constants `video.h:37-39` |
| `VICIIExternalPalette` | int | 0/1 | `video/video-resources.c:932` |
| `VICIIPaletteFile` | **string** | default `"pepto-pal"` | `video/video-resources.c:916`; default from `video_chip_cap.external_palette_name`, `viciisc/vicii-resources.c:187` |
| `VICIIDoubleSize`, `VICIIDoubleScan` | int | 0/1 | `video/video-resources.c:805, 825` |
| `VICIIColorSaturation`, `…Contrast`, `…Brightness`, `…Gamma`, `…Tint` | int | 0..2000, factory 1000 | `video/video-resources.c:586-607` |
| `VICIIPALScanLineShade` | int | 0..1000, factory 750 | `video/video-resources.c:680-687` |
| `VICIIPALBlur` | int | 0..1000, factory 500 | same |
| `VICIIAudioLeak` | int | 0/1, factory 0 | same |
| `VICIIPALOddLinePhase`, `VICIIPALOddLineOffset` | int | 0..2000 | `video/video-resources.c:697-…` |
| `VICIIPALDelaylineType` | int | 0/1 | same |

### Machine model

| resource | type | values | source |
|---|---|---|---|
| `MachineVideoStandard` | int | **1 PAL, 2 NTSC, 3 NTSC-old, 4 PAL-N** | `c64/c64-resources.c:447`; constants `machine.h:57-60`. **DANGEROUS — C.4** |
| `MachinePowerFrequency` | int | 50 or 60 only | `c64/c64-resources.c:449`. **DANGEROUS — C.4** |
| `CIA1Model`, `CIA2Model` | int | 0 = 6526 "old", 1 = 6526A "new" | `c64/c64-resources.c:455-457`; constants `cia.h:37-38` |
| `KernalRev` | int | | `c64/c64-resources.c:459`. **DANGEROUS — C.4** |
| `BoardType` | int | | `c64/c64-resources.c:451` |
| `IECReset` | int | 0/1 | `c64/c64-resources.c:453` |
| `BurstMod` | int | | `c64/c64-resources.c:475` |
| `KernalName`, `BasicName`, `ChargenName` | string | | `c64/c64-resources.c:434-441`. **DANGEROUS — C.4** |

### Speed and warp

| resource | type | values | source |
|---|---|---|---|
| `Speed` | int | percent; **`0` is silently coerced to 100** with a log warning; negative = target FPS | `vsync.c:163-177, 205-206` |
| `InitialWarpMode` | int | 0/1 — **only honoured at launch** | `vsync.c:207-209` |

**There is no runtime `WarpMode` resource.** Warp is a UI action calling
`vsync_set_warp_mode()` (`vsync.c:181-190`) with no resource binding; the command-line
`-warp`/`+warp` go through `CALL_FUNCTION` into a static variable specifically so they do
*not* become a resource (`vsync.c:220-241`, comment: *"We don't want -warp / +warp to end
up in the config file, so we don't use a resource"*). A tree-wide grep for `"WarpMode"`
returns nothing. **`RESOURCE_SET WarpMode 1` will fail with `0x8f`.** The only
runtime-settable speed control over the binary monitor is `Speed`.

### Joystick / joyport

| resource | type | values | source |
|---|---|---|---|
| `JoyPort1Device`, `JoyPort2Device` (…up to 11 where the port exists) | int | joyport device id; default `JOYPORT_ID_JOYSTICK` | `joyport/joyport.c:resources_int_port1/2`, registered `:1673-1685` |
| `JoysticksAreSwapped` | int | 0/1 | `joyport/joyport.c:1592-1595` |

Note the tool surface's primary input path is `JOYPORT_SET` (0xa2), not these resources;
`JoyPortNDevice` only selects *which kind* of device is plugged in.

### Autostart

| resource | type | values | source |
|---|---|---|---|
| `AutostartWarp` | int | 0/1, factory 1 | `autostart.c:410` |
| `AutostartHandleTrueDriveEmulation` | int | 0/1, factory 0 | `autostart.c:408` |
| `AutostartDelay` | int | 0 = automatic | `autostart.c:414` |
| `AutostartDelayRandom` | int | 0/1, factory 1 | `autostart.c:416` |
| `AutostartPrgMode` | int | | `autostart.c:412` |
| `AutostartBasicLoad` | int | | `autostart.c:390` / `:400` |
| `AutostartTapeBasicLoad` | int | | `autostart.c:393` |
| `AutostartRunWithColon` | int | | `autostart.c:406` |
| `AutostartDropMode` | int | | `autostart.c:418` |
| `AutostartPrgDiskImage` | string, default **`NULL`** | | `autostart.c:382` — `RESOURCE_GET` returns `0x01` when unset |

For deterministic RE runs: `AutostartDelayRandom = 0` and `AutostartWarp = 0` are the two
that matter. `AutostartHandleTrueDriveEmulation = 0` is important if you have deliberately
enabled TDE for drive-CPU work — otherwise autostart will change it under you.

### Monitor servers

| resource | type | values | source |
|---|---|---|---|
| `BinaryMonitorServer` | int | 0/1 | `monitor/monitor_binary.c` resources_int. **DANGEROUS — C.4** |
| `BinaryMonitorServerAddress` | string | default `"ip4://127.0.0.1:6502"` | `monitor/monitor_binary.c` resources_string. **DANGEROUS — C.4** |
| `MonitorServer` | int | 0/1 | `monitor/monitor_network.c` |
| `MonitorServerAddress` | string | | `monitor/monitor_network.c` |

`MonitorServer` is genuinely useful: enabling the text remote monitor gives access to
`stopwatch`/`sw` and `device c` (the `default_memspace` escape hatch from A.7). The two
servers coexist — both are polled unconditionally from `monitor_vsync_hook()`
(`monitor.c:404-408`).

## C.4 Dangerous to expose — explicit deny list

The tool surface will hand `RESOURCE_SET` to an LLM. These must be blocked or
double-confirmed.

### Tier 1 — power-cycles the machine, destroying all emulation state. Hard deny.

| resource | mechanism |
|---|---|
| `MachineVideoStandard` | `set_sync_factor()` (`c64/c64-resources.c`) → `machine_change_timing()`, whose last statement is `machine_trigger_reset(MACHINE_RESET_MODE_POWER_CYCLE)` (`c64/c64.c:1367`). RAM cleared, program gone. |
| `VICIIModel` | `set_model()` calls `resources_set_int("MachineVideoStandard", vicii_info[model].video)` whenever the model's video standard differs (`viciisc/vicii-resources.c:144-148`) → same power cycle. Every model change between a PAL and an NTSC chip resets. |
| `MachinePowerFrequency` | `set_power_freq()` calls `machine_change_timing()` (`c64/c64-resources.c`) → same power cycle. Only 50 and 60 are accepted; anything else returns `-1` → `0x8f`. |

These three are one indirection away from `machine_trigger_reset`. There is no warning
and no event other than the ordinary reset. **Do not put them in a settable tool.** If
they must be changeable, do it at broker launch time via command-line arguments, before
the client connects.

### Tier 2 — breaks the monitor connection or the broker's ability to reconnect. Hard deny.

| resource | mechanism |
|---|---|
| `BinaryMonitorServer` | `set_binary_monitor_enabled(0)` calls `monitor_binary_deactivate()`, closing the **listening** socket (`monitor/monitor_binary.c`). The current connection survives (`monitor_check_binary()` does not consult `monitor_binary_enabled`), but the broker can never reconnect after a client restart, and the instance becomes unrecoverable without a kill. |
| `BinaryMonitorServerAddress` | `set_binary_server_address()` calls `monitor_binary_deactivate()` then `monitor_binary_activate()` — rebinds the listener to a different address. The broker's recorded port becomes wrong. |

### Tier 3 — destroys the state you are trying to observe. Require explicit intent.

| resource | mechanism |
|---|---|
| `Drive8TrueEmulation` | Setting it calls `drivecpu_reset_clk(unit)` and `drive_enable()`/`drive_disable()` (`drive/drive-resources.c:81-110`). **Resets the drive CPU.** Necessary for drive debugging (A.3) — expose it, but label it destructive and never set it "just to check". |
| `Drive8Type` | `drive_resources_type()` calls `drive_enable`/`drive_disable`, `machine_bus_status_drivetype_set`, and reattaches images (`drive/drive-resources.c:210-250`). Drive state gone. |
| `KernalRev`, `KernalName`, `BasicName`, `ChargenName` | `set_kernal_revision()` clears and restores KERNAL trap flags and re-patches ROM (`c64/c64-resources.c`); the `*Name` setters trigger ROM file loads. Changing ROM under a running program is unrecoverable. |
| `SidEngine` | `sid_engine_set()` reinitialises the SID backend; all SID chip internal state is discarded. Also returns `-1` → `0x8f` if the requested engine was not compiled in (the `#ifdef` ladder at `sid/sid-resources.c:552-576`), so the failure is build-dependent. |
| `FileSystemDevice8`, `TrapDevice8` | Change how loads are serviced mid-run. Harmless to the machine but will corrupt an in-progress load. |
| Any `*Name`, `*File`, `*Image` string resource | Triggers host file I/O from an LLM-supplied path. Deny by default; if allowed, route through the project's `hostpath.ts`/`container-guard` boundary like every other host path. |

### Tier 4 — safe but with a surprising failure mode. Allow with documentation.

| resource | note |
|---|---|
| `Speed` | `0` is *not* an error — it is silently coerced to 100 with `log_warning` (`vsync.c:166-169`). A tool that sets `Speed = 0` intending "unlimited" gets 100% and no error. Use `InitialWarpMode` at launch for warp instead. |
| `WarpMode` | Does not exist. Any tool advertising warp toggling over `RESOURCE_SET` is wrong (C.3). |
| `VICIIBorderMode` | `set_border_mode()` defers the change to `vsync_on_vsync_do()` (`viciisc/vicii-resources.c:~140`), so it does **not** take effect while the emulator is stopped in the monitor — only after the next `EXIT` + frame. It also changes the framebuffer geometry, invalidating any cached `DISPLAY_GET` dimensions. |
| `VICIIFilter`, `VICIIExternalPalette`, `VICIIPaletteFile`, `VICIIColor*`, `VICIIPAL*` | Safe, no reset. But they change the palette (C.6), so invalidate any cached `PALETTE_GET`. |
| Anything `RES_EVENT_STRICT` | Fails with `0x8f` while netplay is non-idle (`resources.c:resources_set_int` returns `-2`). |

### Recommended posture for the tool surface

Ship an explicit **allow-list**, not a deny-list — the resource namespace is thousands of
names wide and grows every release. A reasonable allow-list for RE work: the
`Drive*TrueEmulation` / `Drive*Type` / `TrapDevice*` / `FileSystemDevice*` group (flagged
destructive), `DriveSoundEmulation*`, the `Autostart*` group, `Speed`, the `VICII` colour
and filter group, `VICIIBorderMode`, `VICIICheckSsColl`/`SbColl`, `VICIIVSPBug`,
`SidModel`, `SidFilters`, `CIA1Model`/`CIA2Model`, `JoyPort*Device`,
`JoysticksAreSwapped`, `MonitorServer`. Expose `RESOURCE_GET` broadly (it is read-only
and side-effect free) but `RESOURCE_SET` only through that list.

## C.5 Resource names are not stable across VICE versions

`TrapDevice8` was `VirtualDevice8` before 3.10, renamed with **no compatibility alias**
(a grep for `VirtualDevice` in the 3.10 tree returns zero hits; `vice/NEWS` describes the
rename). Since the client must support 3.9, any resource in the allow-list needs either a
probe or a version-keyed name table. `RESOURCE_GET` returning `0x01` is the cheap probe —
but see C.1, `0x01` is overloaded with "string value is NULL", so probe integer resources
by preference.

## C.6 `PALETTE_GET` (0x91)

`monitor_binary_process_palette_get()` — `monitor_binary.c:1325-1383`. **Requires VICE ≥ 3.6.**

**Request body:**

| off | size | field | notes |
|---:|---:|---|---|
| 0 | 1 | `use_vic` | only meaningful on x128, where non-zero selects `machine_video_canvas_get(1)` (the VDC); on `x64sc` any value selects canvas 0. **Send `0x00`.** (`monitor_binary.c:1340-1344`) |

Minimum body length 1.

**Response body:**

| off | size | field |
|---:|---:|---|
| 0 | 2 | entry count, uint16 LE (`screenshot.palette->num_entries`) |
| then per entry, **4 bytes** | | |
| +0 | 1 | item size = **3** (`monitor_binary.c:1332`) |
| +1 | 1 | **red** |
| +2 | 1 | **green** |
| +3 | 1 | **blue** |

Total `2 + count * 4`. **RGB order, 8 bits each, no alpha, no padding.** The `dither`
byte that the struct carries is explicitly `#if 0`'d out (`monitor_binary.c:1373-1376`),
so a future VICE could grow the entry to 4 bytes of payload — hence read the per-entry
`item_size` and skip `item_size + 1` bytes rather than hardcoding 4.

**Errors:** `machine_screenshot()` failing → `0x8f CMD_FAILURE` (`monitor_binary.c:1347-1350`).

**Entry count on `x64sc` is 16.** `raster_screenshot()` sets
`screenshot->palette = raster->canvas->palette` (`raster/raster.c:533`), and
`video_color_update_palette()` builds that palette with
`palette_create(cbm_palette->num_entries, ...)` (`video/video-color.c:849` internal path,
`:872` external-file path) where `num_entries` for the VIC-II is
`VICII_NUM_COLORS = 16` (`vicii/viciitypes.h:53`; every `video_cbm_palette_t` in
`vicii/vicii-color.c` uses it). Even an external palette file is forced through the same
16-entry allocation. So 16 in practice — but read the count field and do not hardcode it.

## C.7 How `PALETTE_GET` indices map to `DISPLAY_GET` INDEXED8 values

This needed source verification because the two commands take different code paths.

VICE's own screenshot exporter applies a colour map:

```c
/* screenshot.c:124-128, SCREENSHOT_MODE_PALETTE */
data[i] = screenshot->color_map[line_base[i * screenshot->size_width + screenshot->x_offset]];
```

The binary monitor's converter does **not**:

```c
/* monitor_binary.c, monitor_binary_screenshot_line_data() */
data[(i + true_offset_x)] = line_base[i * screenshot->size_width + screenshot->x_offset];
```

i.e. `DISPLAY_GET` emits **raw draw-buffer bytes**. That is safe, because `color_map` is
constructed as the identity over the palette range and zero elsewhere
(`screenshot.c:161-165`):

```c
screenshot->color_map = lib_calloc(1, 256);
for (i = 0; i < screenshot->palette->num_entries; i++) {
    screenshot->color_map[i] = i;
}
```

**Conclusion: `DISPLAY_GET` INDEXED8 byte value `N` indexes `PALETTE_GET` entry `N`
directly, for every `N < count`.** No offset, no remap.

Two defensive points:

1. For a byte value `>= count` (possible in principle since the monitor skips the map),
   VICE's own PNG export would render palette entry 0. The client should clamp
   out-of-range indices to 0 rather than throwing or reading out of bounds.
2. `monitor_binary_screenshot_line_data()` `memset`s the regions outside the "true offset"
   rectangle to `0x00` (the margin fills, and whole lines when
   `line < true_offset_y || line > true_offset_y + height`). Index 0 is VIC-II black, so
   those areas render black — expected, but worth knowing that a fully black border in a
   captured PNG may be padding rather than emulated border.

**The palette is resource-dependent.** It is recomputed by
`video_color_update_palette()` from: `VICIIModel` (the base chip colour table selected in
`vicii/vicii-color.c`), `VICIIExternalPalette` + `VICIIPaletteFile`, the five
`VICIIColor*` controls, and `VICIIFilter` (the CRT path recomputes via
`video_calc_palette()`). Cache `PALETTE_GET` keyed on those resource values, or simply
re-fetch it whenever a screenshot is taken — it is a 66-byte response.

## Implementation notes for the client (C)

1. **Wire the resource type codes as `0x00 = string`, `0x01 = int`.** They are the inverse
   of VICE's internal `resource_type_t`; do not read `resources.h` values into the client.
2. **Always `RESOURCE_SET` integers as type `0x01` with a 4-byte LE payload.** It is the
   only form that expresses negative values, and it avoids
   `strtol(value, NULL, 0)`'s base-detection trap (`"026"` → 22).
3. **Decode `RESOURCE_GET` integers as signed int32.** `Speed` is legitimately negative.
4. **Do not treat `0x01 OBJECT_MISSING` from `RESOURCE_GET` as "no such resource"** — it
   also means "string resource is `NULL`" and "string longer than 255". Probe with an
   integer resource when doing version/name detection.
5. **`RESOURCE_GET` can return two responses for one request id** when the body is
   malformed (the missing `return` at `monitor_binary.c:931-935`). Make the demultiplexer
   tolerant of a duplicate reply on an already-settled id — log and drop, do not throw.
   The same defensive posture is cheap insurance across the whole client.
6. **Ship an allow-list for `RESOURCE_SET`, not a deny-list**, and hard-block the Tier 1
   and Tier 2 names from C.4. Route every `*Name`/`*File`/`*Image` string through the
   existing host-path boundary. The three Tier 1 names each power-cycle the machine one
   function call deep — an LLM "checking whether the machine is PAL" by setting the
   resource would wipe the session.
7. **Label `Drive8TrueEmulation` and `Drive8Type` as destructive** in the tool
   description. They are needed for group A and they reset the drive CPU.
8. **Do not offer warp via `RESOURCE_SET`.** There is no `WarpMode` resource; use
   `-warp`/`InitialWarpMode` at broker launch, and `Speed` for percentage limiting.
   Remember `Speed = 0` is silently coerced to 100.
9. **Version-key or probe resource names** (`TrapDevice8` vs `VirtualDevice8`) — see C.5.
10. **`PALETTE_GET`: parse with the per-entry `item_size`**, read the count from the
    header, order the components R, G, B, and clamp `DISPLAY_GET` indices `>= count` to 0.
    Cache the palette keyed on `VICIIModel`, `VICIIExternalPalette`, `VICIIPaletteFile`,
    `VICIIFilter` and the five `VICIIColor*` values — or just re-fetch per screenshot.
11. **Invalidate cached `DISPLAY_GET` geometry after `VICIIBorderMode` changes**, and note
    that the change does not apply until the emulator runs a frame.
12. **Probe items:** confirm `PALETTE_GET` returns exactly 16 entries on a real `x64sc`;
    confirm one `DISPLAY_GET` pixel's index against the known VIC-II colour at that
    screen position to validate the identity mapping end to end.

---

## Cross-group corrections and refinements to existing project docs

1. **`docs/phase0-binmon-findings.md` §1** — the register-list names `LIN`/`CYC` are
   *not* the condition-parser names. Conditions require `RL` and `CY`
   (`mon_lex.l:559-560`). Anything in the roadmap that says "set a condition on `LIN`"
   will fail with `0x8f`.
2. **`.planning/notes/stock-vice-migration-revised-loss-ledger.md`**, "Do not span a
   non-stopping checkpoint over all memory — one 0x11 event per instruction" — accurate
   for an *unconditioned* checkpoint, but a **conditioned** full-range checkpoint emits
   0x11 only when the condition passes, because `mon_evaluate_conditional` runs before
   `mon_breakpoint_event` (`mon_breakpoint.c:544-558`). Full-range + raster condition is
   the supported idiom for raster breakpoints. The per-instruction *evaluation* cost
   remains.
3. **New constraint for `PROJECT.md`** — the `default_memspace` contamination described
   in A.7 is a genuine protocol-level statefulness hazard with no direct remedy over the
   binary monitor. It affects `ADVANCE_INSTRUCTIONS`, `EXECUTE_UNTIL_RETURN` and
   `CONDITION_SET`, and it should be recorded as a constraint rather than discovered
   during phase implementation.
4. **New constraint** — there is no runtime `WarpMode` resource in current VICE. Any
   warp-related tool must be launch-time (`-warp` / `InitialWarpMode`) on the stock
   backend.
5. **`CPUHISTORY_GET` count field** is read as uint32 but stored in a `uint16_t`
   (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
