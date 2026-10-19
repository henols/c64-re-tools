// zxrun: the replay core for the ZX Spectrum 48K and 128K (floooh/chips zx.h)
// with the line-command interface of c64run: one command per line on stdin, one
// answer line on stdout ("ok ..." or "err ..."). Time is counted in CPU cycles
// ("ticks") from the first opcode fetch after init (the reset at $0000) or after
// load-z80 (the pc of the snapshot).
//
// It records and replays the IN reads of chosen ports ("inputs", for example
// the keyboard rows and the Kempston port), keyed by site (the pc of the
// reading instruction) and read index, and writes coverage maps of memory and
// of ports. chips is not changed: the harness calls _zx_tick and edits the data
// pins between two ticks.
//
// zx.h counts one scan line too many in a frame (scanline_y++ >= frame_scan_lines),
// so init sets one line less: a frame is 312 x 224 (48K) or 311 x 228 (128K)
// cycles, as on a real Spectrum. zx.h has no contended memory either: the harness
// adds it (see "Contended memory" below), so the ticks are those of a real
// Spectrum and of ZEsarUX.

#define CHIPS_IMPL
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "chips/chips_common.h"
#include "chips/z80.h"
#include "chips/beeper.h"
#include "chips/ay38910.h"
#include "chips/kbd.h"
#include "chips/mem.h"
#include "chips/clk.h"
#include "systems/zx.h"

#define ZXRUN_PROTOCOL 2
#define ROM_48 "48.rom"
// The two 128K ROMs in one file: ROM 0 (the 128 editor), then ROM 1 (48 BASIC).
#define ROM_128 "128.rom"
#ifndef CHIPS_COMMIT
#define CHIPS_COMMIT "unknown"
#endif

static zx_t sys;
static uint64_t pins;
static uint64_t ticks;
static int ready;
static int is128;
static char last_romdir[1024];
static uint16_t last_sync_pc;

// An opcode fetch that starts an instruction: an M1 memory read with no prefix
// active (the M1 after a DD, FD, ED or CB prefix continues the instruction).
static int at_sync(void) {
    return (pins & (Z80_M1 | Z80_MREQ | Z80_RD)) == (Z80_M1 | Z80_MREQ | Z80_RD) && !sys.cpu.prefix_active;
}

// ---- Sites: the IN reads of input ports, counted, recorded and replayed ----

typedef struct { uint64_t from; uint8_t value; } run_t;
typedef struct {
    uint16_t pc, port;
    int rom;                 // the reading instruction is in ROM ($0000-$3FFF)
    uint64_t count;          // reads at this site so far
    int last;                // the last value recorded (-1: none yet)
    run_t* runs;             // replay: the value from each read index on
    size_t nruns, cap, at;
    uint64_t total;          // replay: the reads in the recording
    uint64_t misses;         // replay: reads after the recording ended
} site_t;
#define MAX_SITES 1024
static site_t sites[MAX_SITES];
static int site_count;
static uint8_t input_port[0x10000];
static FILE* record_file;
static int replaying;
static uint64_t replay_unknown;

// A watch stops run-reads when the count of one site reaches a number.
static site_t* watch_site;
static uint16_t watch_pc, watch_port;
static uint64_t watch_count;
static int watch_hit;

static int coverage_on, coverage_armed_input;

static site_t* site_for(uint16_t pc, uint16_t port) {
    for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].port == port) return &sites[i];
    if (site_count == MAX_SITES) return NULL;
    site_t* s = &sites[site_count++];
    memset(s, 0, sizeof *s);
    s->pc = pc;
    s->port = port;
    s->rom = pc < 0x4000;
    s->last = -1;
    return s;
}

static void clear_sites(void) {
    for (int i = 0; i < site_count; i++) free(sites[i].runs);
    site_count = 0;
    watch_site = NULL;
}

// The value of an input read that the recording has no value for. A fixed value
// keeps the replay free of values that depend on timing: the ULA with no key
// ($BF), the Kempston port with no direction ($00), else $FF.
static uint8_t idle_value(uint16_t port) {
    if ((port & 1) == 0) return 0xBF;
    if ((port & 0xE0) == 0) return 0x00;
    return 0xFF;
}

static void input_read(uint16_t pc, uint16_t port) {
    site_t* s = site_for(pc, port);
    if (s == NULL) {
        if (replaying) { Z80_SET_DATA(pins, idle_value(port)); replay_unknown++; }
        return;
    }
    if (coverage_armed_input && !s->rom) { coverage_armed_input = 0; coverage_on = 1; }
    const uint64_t index = s->count++;
    if (replaying) {
        if (s->nruns == 0) {
            Z80_SET_DATA(pins, idle_value(port));
            replay_unknown++;
        } else if (index >= s->total) {
            Z80_SET_DATA(pins, idle_value(port));
            s->misses++;
        } else {
            while (s->at + 1 < s->nruns && s->runs[s->at + 1].from <= index) s->at++;
            Z80_SET_DATA(pins, s->runs[s->at].value);
        }
    }
    if (record_file) {
        const uint8_t value = Z80_GET_DATA(pins);
        if (s->last != value) {
            fprintf(record_file, "%04x %04x %llu %02x\n", pc, port, (unsigned long long)index, value);
            s->last = value;
        }
    }
    if (s == watch_site && s->count >= watch_count) watch_hit = 1;
    else if (watch_site == NULL && watch_count && pc == watch_pc && port == watch_port) {
        watch_site = s;
        if (s->count >= watch_count) watch_hit = 1;
    }
}

// ---- Coverage: one byte per address, the bit format of src/c64.ts COVERAGE ----

enum { COV_RAM_R = 1, COV_RAM_W = 2, COV_RAM_X = 4, COV_ROM_R = 8, COV_ROM_X = 16, COV_IO_R = 32, COV_IO_W = 64 };
static uint8_t coverage[0x10000];
// The 128K: the coverage of $C000-$FFFF per RAM bank, the bank that was paged in
// at each access (8 x 16 KiB, bank n from n * $4000).
static uint8_t bank_coverage[8 * 0x4000];
// The ports: IO_R and IO_W for each 16-bit port address of an IN or OUT.
static uint8_t io_coverage[0x10000];

// As the emulator (VICE) marks a map: the opcode fetch that starts an
// instruction is an execute of its byte. The other reads of the instruction's
// own bytes (the opcode after a prefix, the operands, the opcode of DD CB d op)
// are not counted.
static void cover(uint16_t addr, int start, int read) {
    const int rom = addr < 0x4000;
    uint8_t bit;
    if (start) bit = rom ? COV_ROM_X : COV_RAM_X;
    else if (read) {
        if ((uint16_t)(addr - last_sync_pc) < 4) return;
        bit = rom ? COV_ROM_R : COV_RAM_R;
    }
    else {
        if (rom) return;
        bit = COV_RAM_W;
    }
    coverage[addr] |= bit;
    if (is128 && addr >= 0xC000) bank_coverage[(sys.last_mem_config & 7) * 0x4000 + (addr - 0xC000)] |= bit;
}

// ---- Contended memory: the ULA holds the CPU while it reads the screen ----
//
// The model of Fuse and ZEsarUX: in the 192 screen lines, during the first 128
// cycles of each line, a cycle that puts a contended address on the bus waits
// 6, 5, 4, 3, 2, 1, 0 or 0 cycles. Contended are $4000-$7FFF and, on the 128K,
// $C000-$FFFF when an odd RAM bank is paged in. The cycles are those of the bus:
// the opcode fetch, each memory read and write, the I/O cycle (its own pattern),
// and each internal cycle, which has the address of the last access (IR after an
// opcode fetch) on the bus.
//
// zx.h runs each instruction as a list of steps, one per cycle; a memory cycle is
// an empty step (T1), the access with its WAIT test (T2) and an empty step (T3).
// The harness reads the next step on a copy of the CPU. Empty steps that are no
// part of a machine cycle are internal cycles; they wait until the next access,
// which then gets all their delays at once. A delay is a stall: the ULA, the
// interrupt, the AY and the beeper run on while the CPU stands still.

static int frame_t;          // the cycle of the frame that the next tick runs, in the count of ZEsarUX
static uint32_t frame_seen;  // sys.blink_counter: it counts the frame interrupts
static int rest;             // the ticks of the current machine cycle after its access
static int idle_count, idle_from; // the empty steps since the last access, and the first one's frame cycle
static uint16_t last_addr;   // the address of the last access

static void contention_reset(void) {
    rest = idle_count = 0;
    last_addr = 0;
}

static int contended(uint16_t addr) {
    const int segment = addr >> 14;
    return segment == 1 || (is128 && segment == 3 && (sys.last_mem_config & 1));
}

// The first contended cycle of the frame: 14336 on the 48K and 14362 on the
// 128K in this count, measured against ZEsarUX 13.0 (the usual reference counts
// one cycle less: 14335 and 14361).
static int ula_delay(int t) {
    static const int pattern[8] = { 6, 5, 4, 3, 2, 1, 0, 0 };
    const int frame = is128 ? 70908 : 69888, period = is128 ? 228 : 224, first = is128 ? 14362 : 14336;
    t %= frame;
    if (t < first) return 0;
    const int line = (t - first) / period, at = (t - first) % period;
    return line < 192 && at < 128 ? pattern[at & 7] : 0;
}

// Counts the cycle that just ran. The tick after the one that raised the frame
// interrupt is cycle 0, as ZEsarUX counts the cycles of a frame.
static void count_cycle(void) {
    ticks++;
    if (sys.blink_counter != frame_seen) { frame_seen = sys.blink_counter; frame_t = 0; }
    else frame_t++;
}

// One cycle with the CPU held: zx.h's _zx_tick without the CPU and the bus.
static void stall(int count) {
    while (count-- > 0) {
        if (--sys.scanline_counter <= 0) {
            sys.scanline_counter += sys.scanline_period;
            if (_zx_decode_scanline(&sys)) { pins |= Z80_INT; sys.int_counter = 32; }
        }
        if ((pins & Z80_INT) && --sys.int_counter < 0) pins &= ~Z80_INT;
        if (++sys.tick_count & 1) ay38910_tick(&sys.ay);
        beeper_tick(&sys.beeper);
        count_cycle();
    }
}

// The frame cycle after the empty steps before an access, of which the last
// t1 steps belong to the access's own cycle: each internal cycle waits for the ULA.
static int after_internal(int t1) {
    if (idle_count == 0) return frame_t;
    int v = idle_from;
    for (int i = 0; i < idle_count - t1; i++) v += (contended(last_addr) ? ula_delay(v) : 0) + 1;
    return v;
}

// Before each tick: the delay of the cycle that the next step starts.
static void contend(void) {
    z80_t probe = sys.cpu;
    const uint64_t next = z80_tick(&probe, pins);
    const uint16_t addr = Z80_GET_ADDR(next);
    int v;
    if ((next & (Z80_MREQ | Z80_RFSH)) == (Z80_MREQ | Z80_RFSH)) {
        // T3 of an opcode fetch: IR is on the bus from now on
        last_addr = addr;
        if (rest > 0) rest--;
        return;
    }
    if (next & Z80_MREQ) {
        if (next & Z80_M1) {
            // an opcode fetch: its T1 is this step
            v = after_internal(0);
            v += contended(addr) ? ula_delay(v) : 0;
            rest = 3;
        } else {
            // a memory read or write: its T1 was the empty step before
            const int t1 = idle_count > 0 ? 1 : 0;
            v = after_internal(t1);
            v += (contended(addr) ? ula_delay(v) : 0) + t1;
            rest = 1;
        }
    } else if ((next & (Z80_IORQ | Z80_M1)) == Z80_IORQ) {
        // an I/O cycle of 4 cycles: T1 was 1 (write) or 2 (read) empty steps before
        // The pattern: a contended high byte waits at T1; the ULA (an even port)
        // waits at T2; another port with a contended high byte waits at T2, T3 and T4.
        const int lead = (next & Z80_RD) ? 2 : 1;
        const int t1 = idle_count < lead ? idle_count : lead;
        v = after_internal(t1);
        const int high = contended(addr), ula = (addr & 1) == 0;
        int t = v, delays = 0;
        if (high) { const int d = ula_delay(t); delays += d; t += d; }
        t++;
        for (int i = 0; i < (ula ? 1 : high ? 3 : 0); i++) { const int d = ula_delay(t); delays += d; t += d + 1; }
        v += delays + t1;
        rest = (next & Z80_RD) ? 1 : 2;
    } else if (next & Z80_IORQ) {
        // the interrupt acknowledge: at the start of the frame, out of the screen lines
        v = after_internal(0);
        rest = 0;
    } else {
        if (rest > 0) rest--;
        else { if (idle_count++ == 0) idle_from = frame_t; }
        return;
    }
    if (next & (Z80_MREQ | Z80_IORQ)) last_addr = addr;
    idle_count = 0;
    if (v > frame_t) stall(v - frame_t);
}

// ---- The tick ----

static void tick(void) {
    contend();
    pins = _zx_tick(&sys, pins);
    count_cycle();
    const uint16_t addr = Z80_GET_ADDR(pins);
    if (pins & Z80_MREQ) {
        if (pins & Z80_RFSH) return;
        const int read = (pins & Z80_RD) != 0;
        const int start = (pins & Z80_M1) && read && !sys.cpu.prefix_active;
        if (start) last_sync_pc = addr;
        if (coverage_on && (read || (pins & Z80_WR))) cover(addr, start, read);
    } else if ((pins & Z80_IORQ) && !(pins & Z80_M1)) {
        // An IN or OUT; IORQ with M1 is an interrupt acknowledge.
        if (pins & Z80_RD) {
            if (input_port[addr]) input_read(last_sync_pc, addr);
            if (coverage_on) io_coverage[addr] |= COV_IO_R;
        } else if ((pins & Z80_WR) && coverage_on) io_coverage[addr] |= COV_IO_W;
    }
}

// ---- Files and helpers ----

static uint8_t* read_file(const char* path, size_t want, size_t* got_size) {
    FILE* f = fopen(path, "rb");
    if (!f) return NULL;
    uint8_t* buf = malloc(want);
    size_t got = fread(buf, 1, want, f);
    fclose(f);
    if (got_size) { *got_size = got; return buf; }
    if (got != want) { free(buf); return NULL; }
    return buf;
}

static int write_file(const char* path, const void* data, size_t size) {
    FILE* f = fopen(path, "wb");
    if (!f) return 0;
    size_t put = fwrite(data, 1, size, f);
    fclose(f);
    return put == size;
}

// FNV-1a over the RAM: the 3 banks of the 48K, the 8 banks of the 128K.
static uint32_t state_hash(void) {
    uint32_t h = 2166136261u;
    for (int b = 0; b < (is128 ? 8 : 3); b++) for (int i = 0; i < 0x4000; i++) { h ^= sys.ram[b][i]; h *= 16777619u; }
    return h;
}

static void status(const char* prefix) {
    const int sync = at_sync();
    printf("%s tick=%llu sync=%d pc=%04x af=%04x bc=%04x de=%04x hl=%04x ix=%04x iy=%04x sp=%04x im=%u iff=%d line=%d cycle=%d frame=%d model=%s port7ffd=%02x hash=%08x\n", prefix,
        (unsigned long long)ticks, sync, sync ? Z80_GET_ADDR(pins) : 0xFFFF,
        sys.cpu.af, sys.cpu.bc, sys.cpu.de, sys.cpu.hl, sys.cpu.ix, sys.cpu.iy, sys.cpu.sp, sys.cpu.im, sys.cpu.iff1 ? 1 : 0,
        sys.scanline_y, sys.scanline_period - sys.scanline_counter, frame_t, is128 ? "128k" : "48k", is128 ? sys.last_mem_config : 0, state_hash());
}

// The ROM folder: the argument, C64RT_ZX_ROMS, or ../share/c64-re-tools/roms next to the program.
static void rom_dir(const char* given, const char* argv0, char* out, size_t size) {
    if (given && given[0]) { snprintf(out, size, "%s", given); return; }
    const char* env = getenv("C64RT_ZX_ROMS");
    if (env && env[0]) { snprintf(out, size, "%s", env); return; }
    static char found[1024];
    if (!strchr(argv0, '/')) {
        const char* path = getenv("PATH");
        while (path && *path) {
            const char* next = strchr(path, ':');
            const int length = next ? (int)(next - path) : (int)strlen(path);
            snprintf(found, sizeof found, "%.*s/%s", length, path, argv0);
            FILE* f = fopen(found, "rb");
            if (f) { fclose(f); argv0 = found; break; }
            path = next ? next + 1 : NULL;
        }
    }
    const char* slash = strrchr(argv0, '/');
    if (slash) snprintf(out, size, "%.*s/../share/c64-re-tools/roms", (int)(slash - argv0), argv0);
    else snprintf(out, size, "../share/c64-re-tools/roms");
}

// Runs to the first opcode fetch and makes it tick 0.
static int to_first_sync(void) {
    for (int i = 0; i < 100; i++) {
        tick();
        if (at_sync()) { ticks = 0; last_sync_pc = Z80_GET_ADDR(pins); return 1; }
    }
    return 0;
}

static const char* init(const char* romdir, int want128) {
    static char missing[1200];
    char path[1100];
    const size_t size = want128 ? 0x8000 : 0x4000;
    snprintf(path, sizeof path, "%s/%s", romdir, want128 ? ROM_128 : ROM_48);
    uint8_t* rom = read_file(path, size, NULL);
    if (!rom) { snprintf(missing, sizeof missing, "no ROM %s (%zu bytes)", path, size); return missing; }
    if (ready) zx_discard(&sys);
    ready = 0;
    if (want128) {
        zx_init(&sys, &(zx_desc_t){
            .type = ZX_TYPE_128,
            .joystick_type = ZX_JOYSTICKTYPE_KEMPSTON,
            .roms = { .zx128_0 = { .ptr = rom, .size = 0x4000 }, .zx128_1 = { .ptr = rom + 0x4000, .size = 0x4000 } },
        });
    } else {
        zx_init(&sys, &(zx_desc_t){
            .type = ZX_TYPE_48K,
            .joystick_type = ZX_JOYSTICKTYPE_KEMPSTON,
            .roms = { .zx48k = { .ptr = rom, .size = 0x4000 } },
        });
    }
    free(rom);
    // CAPS SHIFT alone: zx.h knows it only as the shift of another key.
    kbd_register_key(&sys.kbd, 0x0E, 0, 0, 0);
    // One line less than zx.h sets: its frame counter counts frame_scan_lines + 1 lines.
    sys.frame_scan_lines -= 1;
    is128 = want128;
    snprintf(last_romdir, sizeof last_romdir, "%s", romdir);
    // zx.h raises the first interrupt in the last tick of the first frame.
    frame_t = 0;
    frame_seen = sys.blink_counter;
    contention_reset();
    pins = sys.pins;
    ticks = 0;
    if (!to_first_sync()) return "the CPU did not reach the reset address";
    ready = 1;
    return NULL;
}

static int hexbyte(const char* s) {
    unsigned v;
    return sscanf(s, "%2x", &v) == 1 ? (int)v : -1;
}

static const char B64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void print_base64(const uint8_t* data, size_t size) {
    for (size_t i = 0; i < size; i += 3) {
        const uint32_t n = (data[i] << 16) | (i + 1 < size ? data[i + 1] << 8 : 0) | (i + 2 < size ? data[i + 2] : 0);
        putchar(B64[(n >> 18) & 63]);
        putchar(B64[(n >> 12) & 63]);
        putchar(i + 1 < size ? B64[(n >> 6) & 63] : '=');
        putchar(i + 2 < size ? B64[n & 63] : '=');
    }
}

// Loads a recording ("site port from value" lines and "end site port count" lines).
static const char* load_replay(const char* path) {
    static char problem[1200];
    FILE* f = fopen(path, "r");
    if (!f) { snprintf(problem, sizeof problem, "cannot read %s", path); return problem; }
    char row[256];
    int line = 0;
    while (fgets(row, sizeof row, f)) {
        line++;
        unsigned pc, port, value;
        unsigned long long n;
        int end = 0;
        if (sscanf(row, "end %x %x %llu", &pc, &port, &n) == 3) end = 1;
        else if (sscanf(row, "%x %x %llu %x", &pc, &port, &n, &value) != 4) {
            if (row[0] == '\n' || row[0] == '#') continue;
            fclose(f);
            snprintf(problem, sizeof problem, "%s line %d is not \"site port from value\" or \"end site port count\"", path, line);
            return problem;
        }
        site_t* s = site_for(pc, port);
        if (!s) { fclose(f); snprintf(problem, sizeof problem, "more than %d sites", MAX_SITES); return problem; }
        if (end) { s->total = n; continue; }
        if (s->nruns == s->cap) { s->cap = s->cap ? s->cap * 2 : 64; s->runs = realloc(s->runs, s->cap * sizeof(run_t)); }
        s->runs[s->nruns++] = (run_t){ .from = n, .value = (uint8_t)value };
    }
    fclose(f);
    return NULL;
}

static int need_ready(void) {
    if (!ready) printf("err give init first\n");
    return ready;
}

int main(int argc, char** argv) {
    setvbuf(stdout, NULL, _IOLBF, 0);
    if (argc > 1 && !strcmp(argv[1], "--version")) {
        // The version, and whether the default ROM folder has the ROM.
        char dir[1024], path[1100];
        rom_dir(NULL, argv[0], dir, sizeof dir);
        printf("zxrun protocol=%d chips=%s\n", ZXRUN_PROTOCOL, CHIPS_COMMIT);
        const char* names[] = { ROM_48, ROM_128 };
        const char* absent = NULL;
        for (int i = 0; i < 2; i++) {
            snprintf(path, sizeof path, "%s/%s", dir, names[i]);
            FILE* f = fopen(path, "rb");
            if (f) fclose(f); else if (!absent) absent = names[i];
        }
        if (!absent) printf("roms=ok %s\n", dir); else printf("roms=missing %s has no %s\n", dir, absent);
        return 0;
    }
    static char line[1 << 17], cmd[64], a1[1024], a2[1 << 16];
    while (fgets(line, sizeof line, stdin)) {
        a1[0] = a2[0] = 0;
        int n = sscanf(line, "%63s %1023s %65535s", cmd, a1, a2);
        if (n < 1) continue;
        if (!strcmp(cmd, "version")) {
            printf("ok zxrun protocol=%d chips=%s\n", ZXRUN_PROTOCOL, CHIPS_COMMIT);
        } else if (!strcmp(cmd, "init")) {
            // init 48k|128k [<rom folder>]: power on; the CPU stops at the first opcode fetch, tick 0
            if (n < 2 || (strcmp(a1, "48k") && strcmp(a1, "128k"))) { printf("err init: give 48k or 128k\n"); continue; }
            char dir[1024];
            rom_dir(n >= 3 ? a2 : NULL, argv[0], dir, sizeof dir);
            clear_sites();
            replaying = 0;
            replay_unknown = 0;
            last_sync_pc = 0;
            coverage_on = coverage_armed_input = 0;
            if (record_file) { fclose(record_file); record_file = NULL; }
            memset(coverage, 0, sizeof coverage);
            memset(io_coverage, 0, sizeof io_coverage);
            memset(bank_coverage, 0, sizeof bank_coverage);
            const char* problem = init(dir, !strcmp(a1, "128k"));
            if (problem) printf("err init: %s\n", problem); else status("ok");
        } else if (!strcmp(cmd, "quit")) {
            break;
        } else if (!need_ready()) {
            continue;
        } else if (!strcmp(cmd, "status")) {
            status("ok");
        } else if (!strcmp(cmd, "load-z80")) {
            // load-z80 <file>: a .z80 snapshot of a 48K or a 128K; the machine becomes
            // that model, and the CPU stops at the snapshot pc, tick 0
            size_t size = 0;
            uint8_t* b = read_file(a1, 1 << 20, &size);
            if (!b) { printf("err load-z80: cannot read %s\n", a1); continue; }
            // Version 1 has a pc in the header; versions 2 and 3 give the hardware after it
            // (version 2: 3 and 4 are a 128K; version 3: 4, 5 and 6 are a 128K).
            int want128 = 0;
            if (size > 34 && b[6] == 0 && b[7] == 0) {
                const int length = b[30] | (b[31] << 8), mode = b[34];
                want128 = length == 23 ? mode >= 3 : mode >= 4 && mode <= 6;
                if (length != 23 && mode == 3) { free(b); printf("err load-z80: %s is a 48K with an MGT interface\n", a1); continue; }
            }
            if (want128 != is128) {
                const char* problem = init(last_romdir, want128);
                if (problem) { free(b); printf("err load-z80: %s\n", problem); continue; }
                ready = 1;
            }
            const int loaded = size > 30 && zx_quickload(&sys, (chips_range_t){ .ptr = b, .size = size });
            free(b);
            if (!loaded) { printf("err load-z80: %s is not a .z80 snapshot of a 48K or a 128K\n", a1); continue; }
            contention_reset();
            pins = sys.pins;
            if (!to_first_sync()) { printf("err load-z80: the CPU did not reach the snapshot pc\n"); continue; }
            status("ok");
        } else if (!strcmp(cmd, "ram-dump")) {
            // ram-dump <file>: the 64 KiB that the CPU sees (ROM and RAM)
            static uint8_t all[0x10000];
            for (int i = 0; i < 0x10000; i++) all[i] = mem_rd(&sys.mem, (uint16_t)i);
            printf(write_file(a1, all, sizeof all) ? "ok\n" : "err ram-dump: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "bank-dump")) {
            // bank-dump <n> <file>: the 16 KiB of RAM bank n (128K: 0-7; 48K: 0-2 at $4000, $8000, $C000)
            const int bank = atoi(a1);
            if (a1[0] < '0' || a1[0] > '7' || a1[1] || bank >= (is128 ? 8 : 3)) { printf("err bank-dump: give a bank 0-%d and a file\n", is128 ? 7 : 2); continue; }
            printf(write_file(a2, sys.ram[bank], 0x4000) ? "ok\n" : "err bank-dump: cannot write %s\n", a2);
        } else if (!strcmp(cmd, "write")) {
            // write <addr hex> <bytes hex>: into RAM (writes to ROM have no effect)
            unsigned addr;
            size_t len = strlen(a2);
            if (sscanf(a1, "%x", &addr) != 1 || len % 2) { printf("err write: give an address and hex bytes\n"); continue; }
            for (size_t i = 0; i < len / 2; i++) mem_wr(&sys.mem, (uint16_t)(addr + i), (uint8_t)hexbyte(a2 + 2 * i));
            printf("ok %zu\n", len / 2);
        } else if (!strcmp(cmd, "peek")) {
            // peek <addr hex> <count>: bytes as the CPU sees them, as hex
            unsigned addr, count;
            if (sscanf(line, "%*s %x %u", &addr, &count) != 2 || count > 4096) { printf("err peek: give an address and 1-4096\n"); continue; }
            printf("ok ");
            for (unsigned i = 0; i < count; i++) printf("%02x", mem_rd(&sys.mem, (uint16_t)(addr + i)));
            printf("\n");
        } else if (!strcmp(cmd, "regs")) {
            // regs <af> <bc> <de> <hl> <ix> <iy> <sp> (hex)
            unsigned af, bc, de, hl, ix, iy, sp;
            if (sscanf(line, "%*s %x %x %x %x %x %x %x", &af, &bc, &de, &hl, &ix, &iy, &sp) != 7) { printf("err regs: give af bc de hl ix iy sp in hex\n"); continue; }
            sys.cpu.af = af; sys.cpu.bc = bc; sys.cpu.de = de; sys.cpu.hl = hl; sys.cpu.ix = ix; sys.cpu.iy = iy; sys.cpu.sp = sp;
            status("ok");
        } else if (!strcmp(cmd, "goto")) {
            // goto <pc hex>: continue at pc, at its opcode fetch
            unsigned pc;
            if (sscanf(a1, "%x", &pc) != 1 || !at_sync()) { printf("err goto: give a pc, at an opcode fetch (run-sync first)\n"); continue; }
            pins = z80_prefetch(&sys.cpu, (uint16_t)pc);
            const uint64_t at = ticks;
            tick();
            ticks = at;
            status("ok");
        } else if (!strcmp(cmd, "run")) {
            // run <tick>: run to the absolute tick (a tick in the past does nothing)
            const unsigned long long target = strtoull(a1, NULL, 10);
            while (ticks < target) tick();
            status("ok");
        } else if (!strcmp(cmd, "run-sync")) {
            // run-sync: run to the next opcode fetch
            do tick(); while (!at_sync());
            status("ok");
        } else if (!strcmp(cmd, "run-pc")) {
            // run-pc <pc hex> <until tick>: run to the next opcode fetch at pc
            unsigned pc;
            const unsigned long long until = strtoull(a2, NULL, 10);
            if (sscanf(a1, "%x", &pc) != 1) { printf("err run-pc: give a pc and a tick\n"); continue; }
            do tick(); while (!(at_sync() && Z80_GET_ADDR(pins) == pc) && ticks < until);
            status(at_sync() && Z80_GET_ADDR(pins) == pc ? "ok reached" : "ok not-reached");
        } else if (!strcmp(cmd, "run-reads")) {
            // run-reads <pc hex> <port hex> <n> <until tick>: run until the site has n reads
            unsigned pc, port;
            unsigned long long count, until;
            if (sscanf(line, "%*s %x %x %llu %llu", &pc, &port, &count, &until) != 4) { printf("err run-reads: give a site, a count and a tick\n"); continue; }
            watch_pc = pc;
            watch_port = port;
            watch_count = count;
            watch_site = NULL;
            for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].port == port) watch_site = &sites[i];
            watch_hit = watch_site && watch_site->count >= count;
            while (!watch_hit && ticks < until) tick();
            watch_count = 0;
            watch_site = NULL;
            status(watch_hit ? "ok reached" : "ok not-reached");
        } else if (!strcmp(cmd, "reads")) {
            // reads <pc hex> <port hex>: the read count of a site
            unsigned pc, port;
            if (sscanf(line, "%*s %x %x", &pc, &port) != 2) { printf("err reads: give a site\n"); continue; }
            uint64_t count = 0;
            for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].port == port) count = sites[i].count;
            printf("ok count=%llu\n", (unsigned long long)count);
        } else if (!strcmp(cmd, "joy")) {
            // joy <mask hex>: Kempston; 1 right, 2 left, 4 down, 8 up, 10 fire
            unsigned mask;
            if (sscanf(a1, "%x", &mask) != 1) { printf("err joy: give a mask\n"); continue; }
            zx_joystick(&sys, (uint8_t)mask);
            printf("ok\n");
        } else if (!strcmp(cmd, "key")) {
            // key <code hex> down|up: a key as chips maps it (a-z, 0-9, space 20,
            // enter 0d, symbol shift 0f, caps shift 0e; capitals press CAPS SHIFT)
            unsigned code;
            if (sscanf(a1, "%x", &code) != 1 || (strcmp(a2, "down") && strcmp(a2, "up"))) { printf("err key: give a code and down or up\n"); continue; }
            if (!strcmp(a2, "down")) kbd_key_down(&sys.kbd, (int)code);
            else {
                // chips releases a key in kbd_update, after its sticky time: one call
                // passes that time, the next one releases.
                kbd_key_up(&sys.kbd, (int)code);
                kbd_update(&sys.kbd, 20000);
                kbd_update(&sys.kbd, 0);
            }
            printf("ok\n");
        } else if (!strcmp(cmd, "inputs")) {
            // inputs <port|from-to|xxNN,...>: the ports (hex, 16 bits) that record and
            // replay handle; xxNN is each port with the low byte NN
            memset(input_port, 0, sizeof input_port);
            int count = 0;
            for (char* part = strtok(a1, ","); part; part = strtok(NULL, ",")) {
                unsigned from, to, low;
                if (sscanf(part, "xx%2x", &low) == 1) {
                    for (unsigned high = 0; high < 0x100; high++) { input_port[(high << 8) | low] = 1; count++; }
                    continue;
                }
                int fields = sscanf(part, "%x-%x", &from, &to);
                if (fields == 1) to = from;
                if (fields < 1 || to > 0xFFFF || to < from) { count = -1; break; }
                for (unsigned port = from; port <= to; port++) { input_port[port] = 1; count++; }
            }
            if (count < 0) printf("err inputs: give ports $0000-$FFFF\n"); else printf("ok inputs=%d\n", count);
        } else if (!strcmp(cmd, "record")) {
            // record <file> | off: "site port from value" when the value at a site changes;
            // off adds "end site port count" for each site
            if (record_file) {
                for (int i = 0; i < site_count; i++) fprintf(record_file, "end %04x %04x %llu\n", sites[i].pc, sites[i].port, (unsigned long long)sites[i].count);
                fclose(record_file);
                record_file = NULL;
            }
            if (!strcmp(a1, "off")) { printf("ok\n"); continue; }
            if (replaying) { printf("err record: a replay runs\n"); continue; }
            for (int i = 0; i < site_count; i++) sites[i].last = -1;
            record_file = fopen(a1, "w");
            if (record_file) printf("ok\n"); else printf("err record: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "replay")) {
            // replay <file>: the reads of input ports at each site get the recorded values
            if (record_file) { printf("err replay: a recording runs\n"); continue; }
            const char* problem = load_replay(a1);
            if (problem) { printf("err replay: %s\n", problem); continue; }
            replaying = 1;
            replay_unknown = 0;
            int with = 0;
            for (int i = 0; i < site_count; i++) with += sites[i].nruns > 0;
            printf("ok sites=%d\n", with);
        } else if (!strcmp(cmd, "sites")) {
            // sites: each site as pc/port:reads:ram|rom (in a replay also :recorded:misses)
            printf("ok unknown=%llu", (unsigned long long)replay_unknown);
            for (int i = 0; i < site_count; i++) {
                printf(" %04x/%04x:%llu:%s", sites[i].pc, sites[i].port, (unsigned long long)sites[i].count, sites[i].rom ? "rom" : "ram");
                if (replaying) printf(":%llu:%llu", (unsigned long long)sites[i].total, (unsigned long long)sites[i].misses);
            }
            printf("\n");
        } else if (!strcmp(cmd, "coverage")) {
            // coverage on | on-input | off | <file>: start now, at the first input read
            // of code in RAM; stop; or write the 65536-byte memory map
            if (!strcmp(a1, "on")) {
                memset(coverage, 0, sizeof coverage);
                memset(io_coverage, 0, sizeof io_coverage);
                memset(bank_coverage, 0, sizeof bank_coverage);
                coverage_on = 1;
                coverage_armed_input = 0;
                // At an opcode fetch the fetch is on the bus already: its instruction counts.
                if (at_sync()) cover(Z80_GET_ADDR(pins), 1, 1);
                printf("ok\n");
            }
            else if (!strcmp(a1, "on-input")) { memset(coverage, 0, sizeof coverage); memset(io_coverage, 0, sizeof io_coverage); memset(bank_coverage, 0, sizeof bank_coverage); coverage_on = 0; coverage_armed_input = 1; printf("ok\n"); }
            else if (!strcmp(a1, "off")) { coverage_on = coverage_armed_input = 0; printf("ok\n"); }
            else printf(write_file(a1, coverage, sizeof coverage) ? "ok\n" : "err coverage: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "bank-coverage")) {
            // bank-coverage <file>: the 128K map of $C000-$FFFF per RAM bank (8 x 16384 bytes, bank n from n * 16384)
            if (!is128) { printf("err bank-coverage: the 48K has no paged banks\n"); continue; }
            printf(write_file(a1, bank_coverage, sizeof bank_coverage) ? "ok\n" : "err bank-coverage: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "io-coverage")) {
            // io-coverage <file>: the 65536-byte port map (IO_R, IO_W)
            printf(write_file(a1, io_coverage, sizeof io_coverage) ? "ok\n" : "err io-coverage: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "palette")) {
            // palette: the 16 colours as RRGGBB
            chips_display_info_t info = zx_display_info(&sys);
            const uint32_t* pal = info.palette.ptr;
            printf("ok");
            for (int i = 0; i < 16; i++) printf(" %02x%02x%02x", pal[i] & 0xFF, (pal[i] >> 8) & 0xFF, (pal[i] >> 16) & 0xFF);
            printf("\n");
        } else if (!strcmp(cmd, "frame")) {
            // frame: the visible screen as palette indices, "ok <width> <height> <base64>"
            chips_display_info_t info = zx_display_info(&sys);
            const int w = info.screen.width, h = info.screen.height, stride = info.frame.dim.width;
            const uint8_t* fb = info.frame.buffer.ptr;
            static uint8_t visible[ZX_DISPLAY_WIDTH * ZX_DISPLAY_HEIGHT];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) visible[y * w + x] = fb[(info.screen.y + y) * stride + info.screen.x + x] & 0x0F;
            printf("ok %d %d ", w, h);
            print_base64(visible, (size_t)w * h);
            printf("\n");
        } else {
            printf("err unknown %s\n", cmd);
        }
    }
    if (record_file) {
        for (int i = 0; i < site_count; i++) fprintf(record_file, "end %04x %04x %llu\n", sites[i].pc, sites[i].port, (unsigned long long)sites[i].count);
        fclose(record_file);
    }
    return 0;
}
