// c64run: the replay core of c64-re-tools. A PAL C64 (floooh/chips c64.h) with a
// line-command interface: one command per line on stdin, one answer line on
// stdout ("ok ..." or "err ..."). Time is counted in CPU cycles ("ticks") from
// the opcode fetch at the reset vector (tick 0).
//
// It records and replays the reads of chosen I/O addresses ("inputs", for
// example the joystick ports and the SID noise), keyed by site (the pc of the
// reading instruction) and read index, and writes coverage maps and samples
// of RAM at a routine entry. chips is not changed: the harness calls
// _c64_tick and edits the data pins between two ticks.

#define CHIPS_IMPL
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "chips/chips_common.h"
#include "chips/m6502.h"
#include "chips/m6526.h"
#include "chips/m6569.h"
#include "chips/m6581.h"
#include "chips/kbd.h"
#include "chips/mem.h"
#include "chips/clk.h"
#include "systems/c1530.h"
#include "chips/m6522.h"
#include "systems/c1541.h"
#include "systems/c64.h"

#define C64RUN_PROTOCOL 3
// Keys that chips has no code for: each SHIFT alone, and the up arrow.
#define C64RUN_KEY_LSHIFT 0x11
#define C64RUN_KEY_RSHIFT 0x12
#define C64RUN_KEY_UPARROW 0x5E
#ifndef CHIPS_COMMIT
#define CHIPS_COMMIT "unknown"
#endif

static c64_t sys;
static uint64_t pins;
static uint64_t ticks;
static int ready;
static uint16_t last_sync_pc;

// ---- Sites: the reads of input addresses, counted, recorded and replayed ----

typedef struct { uint64_t from; uint8_t value; } run_t;
typedef struct {
    uint16_t pc, addr;
    int rom;                 // the reading instruction is in ROM (KERNAL or BASIC)
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
static uint8_t input_addr[0x1000];
static FILE* record_file;
static int replaying;
static uint64_t replay_unknown;
static uint16_t map_from[MAX_SITES], map_to[MAX_SITES];
static int maps;

// A watch stops run-reads when the count of one site reaches a number.
static site_t* watch_site;
static uint16_t watch_pc, watch_addr;
static uint64_t watch_count;
static int watch_hit;

static int area(uint16_t addr);
static int coverage_on, coverage_armed_input;
static void coverage_start(uint16_t pc);

static site_t* site_for(uint16_t pc, uint16_t addr) {
    for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].addr == addr) return &sites[i];
    if (site_count == MAX_SITES) return NULL;
    site_t* s = &sites[site_count++];
    memset(s, 0, sizeof *s);
    s->pc = pc;
    s->addr = addr;
    s->rom = ready && area(pc) == 1;
    s->last = -1;
    return s;
}

static void clear_sites(void) {
    for (int i = 0; i < site_count; i++) free(sites[i].runs);
    site_count = 0;
    watch_site = NULL;
}

// The value of an input read that the recording has no value for: a site that it
// does not know, or a read after its end. A fixed value keeps the replay free of
// values that depend on timing: no joystick, key or paddle ($FF), else $00.
static uint8_t idle_value(uint16_t addr) {
    if (addr == 0xDC00 || addr == 0xDC01 || addr == 0xD419 || addr == 0xD41A) return 0xFF;
    return 0x00;
}

static void input_read(uint16_t pc, uint16_t addr) {
    site_t* s = site_for(pc, addr);
    if (s == NULL) {
        if (replaying) { M6502_SET_DATA(pins, idle_value(addr)); replay_unknown++; }
        return;
    }
    if (coverage_armed_input && !s->rom) { coverage_armed_input = 0; coverage_start(pc); }
    const uint64_t index = s->count++;
    if (replaying) {
        if (s->nruns == 0) {
            M6502_SET_DATA(pins, idle_value(addr));
            replay_unknown++;
        } else if (index >= s->total) {
            M6502_SET_DATA(pins, idle_value(addr));
            s->misses++;
        } else {
            while (s->at + 1 < s->nruns && s->runs[s->at + 1].from <= index) s->at++;
            M6502_SET_DATA(pins, s->runs[s->at].value);
        }
    }
    if (record_file) {
        const uint8_t value = M6502_GET_DATA(pins);
        if (s->last != value) {
            fprintf(record_file, "%04x %04x %llu %02x\n", pc, addr, (unsigned long long)index, value);
            s->last = value;
        }
    }
    if (s == watch_site && s->count >= watch_count) watch_hit = 1;
    else if (watch_site == NULL && watch_count && pc == watch_pc && addr == watch_addr) {
        watch_site = s;
        if (s->count >= watch_count) watch_hit = 1;
    }
}

// ---- Coverage: one byte per address, the bit format of src/c64.ts COVERAGE ----

enum { COV_RAM_R = 1, COV_RAM_W = 2, COV_RAM_X = 4, COV_ROM_R = 8, COV_ROM_X = 16, COV_IO_R = 32, COV_IO_W = 64, COV_IO_X = 128 };
static uint8_t coverage[0x10000];
// Set by "coverage on-checkpoint": the map starts at the first sample. coverage_armed_input,
// set by "coverage on-input": the map starts at the first input read of code in RAM.
// coverage_armed_pc, set by "coverage on-pc": the map starts at the first opcode fetch at coverage_pc.
static int coverage_armed, coverage_armed_pc;
static uint16_t coverage_pc;
// Where the map started: the tick and the pc of the instruction ("coverage status").
static int coverage_started;
static uint64_t coverage_from_tick;
static uint16_t coverage_from_pc;

static void coverage_start(uint16_t pc) {
    coverage_on = coverage_started = 1;
    coverage_from_tick = ticks;
    coverage_from_pc = pc;
}

// Clears the map and every way that it can start.
static void coverage_reset(void) {
    memset(coverage, 0, sizeof coverage);
    coverage_on = coverage_armed = coverage_armed_input = coverage_armed_pc = coverage_started = 0;
}

// 0: RAM, 1: ROM, 2: I/O, as the CPU sees the address now (the CPU port bits).
static int area(uint16_t addr) {
    const uint8_t port = sys.cpu_port;
    if (addr < 0xA000 || (addr >= 0xC000 && addr < 0xD000)) return 0;
    if ((port & 3) == 0) return 0;
    if (addr < 0xC000) return (port & 3) == 3 ? 1 : 0;
    if (addr < 0xE000) return (port & 4) ? 2 : 1;
    return (port & 2) ? 1 : 0;
}

// As the emulator (VICE) marks a map: an opcode fetch is an execute of its byte,
// and the reads of the next two bytes (the operand, or the dummy read of a
// one-byte instruction) are not counted.
static void cover(uint16_t addr, int sync, int read) {
    const int where = area(addr);
    uint8_t bit;
    if (sync) bit = where == 0 ? COV_RAM_X : where == 1 ? COV_ROM_X : COV_IO_X;
    else if (read) {
        if ((uint16_t)(addr - last_sync_pc - 1) < 2) return;
        bit = where == 0 ? COV_RAM_R : where == 1 ? COV_ROM_R : COV_IO_R;
    }
    else bit = where == 2 ? COV_IO_W : COV_RAM_W;
    coverage[addr] |= bit;
}

// ---- Samples: at each opcode fetch at one pc, the tick and some RAM ranges ----

static FILE* sample_file;
static uint16_t sample_pc;
static uint16_t sample_from[16], sample_size[16];
static int sample_ranges;
static uint64_t samples, sample_stop;
// Set when the sample count reaches sample_stop: every run command stops there.
static int halted;

// Pins: at each sample, before it is taken, the next line of a pin file
// ("hex hex ...", one field for each range) goes into RAM. A replay pins the
// random state of a rebuild to the values of the original this way.
static FILE* pin_file;
static uint16_t pin_from[16], pin_size[16];
static int pin_ranges;
static uint64_t pinned;

static void pin(void) {
    for (int r = 0; r < pin_ranges; r++) {
        for (int i = 0; i < pin_size[r]; i++) {
            unsigned value;
            if (fscanf(pin_file, " %2x", &value) != 1) { fclose(pin_file); pin_file = NULL; return; }
            sys.ram[(pin_from[r] + i) & 0xFFFF] = (uint8_t)value;
        }
    }
    pinned++;
}

static void sample(void) {
    if (pin_file) pin();
    fprintf(sample_file, "%llu", (unsigned long long)ticks);
    for (int r = 0; r < sample_ranges; r++) {
        fputc(' ', sample_file);
        for (int i = 0; i < sample_size[r]; i++) fprintf(sample_file, "%02x", sys.ram[(sample_from[r] + i) & 0xFFFF]);
    }
    fputc('\n', sample_file);
    samples++;
    if (coverage_armed) { coverage_armed = 0; coverage_start(sample_pc); }
    if (sample_stop && samples >= sample_stop) halted = 1;
}

// ---- The tick ----

static void tick(void) {
    pins = _c64_tick(&sys, pins);
    // A read cycle repeats while the VIC-II holds RDY (the CPU sees it on its
    // next tick); only the tick that returns with RDY off is the read.
    const int decoded = !(pins & M6502_RDY);
    const uint16_t addr = M6502_GET_ADDR(pins);
    const int read = (pins & M6502_RW) != 0;
    const int sync = (pins & M6502_SYNC) != 0;
    if (sync) {
        last_sync_pc = addr;
        if (sample_file && addr == sample_pc && decoded) sample();
        if (coverage_armed_pc && addr == coverage_pc && decoded) { coverage_armed_pc = 0; coverage_start(addr); }
    }
    if (read && !sync && decoded && sys.io_mapped && (addr & 0xF000) == 0xD000 && input_addr[addr & 0x0FFF]) {
        input_read(last_sync_pc, addr);
    }
    if (coverage_on && (decoded || !read) && !M6510_CHECK_IO(pins)) cover(addr, sync, read);
    ticks++;
}

// ---- Files and helpers ----

static uint8_t* read_file(const char* path, size_t want) {
    FILE* f = fopen(path, "rb");
    if (!f) return NULL;
    uint8_t* buf = malloc(want);
    size_t got = fread(buf, 1, want, f);
    fclose(f);
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

// FNV-1a over RAM from $0002 (not the RAM under the CPU port) and the low nibbles of colour RAM.
static uint32_t state_hash(void) {
    uint32_t h = 2166136261u;
    for (int i = 2; i < 0x10000; i++) { h ^= sys.ram[i]; h *= 16777619u; }
    for (int i = 0; i < 0x400; i++) { h ^= sys.color_ram[i] & 0x0F; h *= 16777619u; }
    return h;
}

static void status(const char* prefix) {
    if (halted) prefix = "ok halted";
    printf("%s tick=%llu sync=%d pc=%04x a=%02x x=%02x y=%02x s=%02x p=%02x line=%u cycle=%u hash=%08x\n", prefix,
        (unsigned long long)ticks, (pins & M6502_SYNC) ? 1 : 0, (pins & M6502_SYNC) ? M6502_GET_ADDR(pins) : 0xFFFF,
        sys.cpu.A, sys.cpu.X, sys.cpu.Y, sys.cpu.S, sys.cpu.P, sys.vic.rs.v_count, sys.vic.rs.h_count, state_hash());
}

static const char* rom_names[3] = { "kernal-901227-03.bin", "basic-901226-01.bin", "chargen-901225-01.bin" };

// The ROM folder: the argument, C64RT_C64_ROMS, or ../share/c64-re-tools/roms next to the program.
static void rom_dir(const char* given, const char* argv0, char* out, size_t size) {
    if (given && given[0]) { snprintf(out, size, "%s", given); return; }
    const char* env = getenv("C64RT_C64_ROMS");
    if (env && env[0]) { snprintf(out, size, "%s", env); return; }
    // Started by name: find the program on PATH.
    static char found[1024];
    if (!strchr(argv0, '/') && !strchr(argv0, '\\')) {
#ifdef _WIN32
        const char separator = ';';
#else
        const char separator = ':';
#endif
        const char* path = getenv("PATH");
        while (path && *path) {
            const char* next = strchr(path, separator);
            const int length = next ? (int)(next - path) : (int)strlen(path);
            snprintf(found, sizeof found, "%.*s/%s", length, path, argv0);
            FILE* f = fopen(found, "rb");
            if (f) { fclose(f); argv0 = found; break; }
            path = next ? next + 1 : NULL;
        }
    }
    const char* slash = strrchr(argv0, '/');
    const char* back = strrchr(argv0, '\\');
    if (back && (!slash || back > slash)) slash = back;
    if (slash) snprintf(out, size, "%.*s/../share/c64-re-tools/roms", (int)(slash - argv0), argv0);
    else snprintf(out, size, "../share/c64-re-tools/roms");
}

static const char* init(const char* romdir) {
    static char missing[1200];
    char path[1100];
    uint8_t* rom[3];
    const size_t sizes[3] = { 0x2000, 0x2000, 0x1000 };
    for (int i = 0; i < 3; i++) {
        snprintf(path, sizeof path, "%s/%s", romdir, rom_names[i]);
        rom[i] = read_file(path, sizes[i]);
        if (!rom[i]) { snprintf(missing, sizeof missing, "no ROM %s (%zu bytes)", path, sizes[i]); return missing; }
    }
    if (ready) c64_discard(&sys);
    c64_init(&sys, &(c64_desc_t){
        .roms = {
            .kernal = { .ptr = rom[0], .size = 0x2000 },
            .basic = { .ptr = rom[1], .size = 0x2000 },
            .chars = { .ptr = rom[2], .size = 0x1000 },
        },
    });
    // The matrix positions (column, line) of the keys that chips has no code for.
    kbd_register_key(&sys.kbd, C64RUN_KEY_LSHIFT, 7, 1, 0);
    kbd_register_key(&sys.kbd, C64RUN_KEY_RSHIFT, 4, 6, 0);
    kbd_register_key(&sys.kbd, C64RUN_KEY_UPARROW, 6, 6, 0);
    const uint16_t vector = rom[0][0x1FFC] | (rom[0][0x1FFD] << 8);
    for (int i = 0; i < 3; i++) free(rom[i]);
    pins = sys.pins;
    ticks = 0;
    for (int i = 0; i < 100; i++) {
        tick();
        if ((pins & M6502_SYNC) && M6502_GET_ADDR(pins) == vector) {
            ticks = 0;
            ready = 1;
            return NULL;
        }
    }
    return "the CPU did not reach the reset vector";
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

// Loads a recording ("site addr from value" lines and "end site addr count" lines).
static const char* load_replay(const char* path) {
    static char problem[1200];
    FILE* f = fopen(path, "r");
    if (!f) { snprintf(problem, sizeof problem, "cannot read %s", path); return problem; }
    char row[256];
    int line = 0;
    while (fgets(row, sizeof row, f)) {
        line++;
        unsigned pc, addr, value;
        unsigned long long n;
        int end = 0;
        if (sscanf(row, "end %x %x %llu", &pc, &addr, &n) == 3) end = 1;
        else if (sscanf(row, "%x %x %llu %x", &pc, &addr, &n, &value) != 4) {
            if (row[0] == '\n' || row[0] == '#') continue;
            fclose(f);
            snprintf(problem, sizeof problem, "%s line %d is not \"site addr from value\" or \"end site addr count\"", path, line);
            return problem;
        }
        for (int i = 0; i < maps; i++) if (map_from[i] == pc) { pc = map_to[i]; break; }
        site_t* s = site_for(pc, addr);
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
        // The version, and whether the default ROM folder has the three ROMs.
        char dir[1024], path[1100];
        rom_dir(NULL, argv[0], dir, sizeof dir);
        const char* absent = NULL;
        for (int i = 0; i < 3 && !absent; i++) {
            snprintf(path, sizeof path, "%s/%s", dir, rom_names[i]);
            FILE* f = fopen(path, "rb");
            if (f) fclose(f); else absent = rom_names[i];
        }
        printf("c64run protocol=%d chips=%s\n", C64RUN_PROTOCOL, CHIPS_COMMIT);
        if (absent) printf("roms=missing %s has no %s\n", dir, absent); else printf("roms=ok %s\n", dir);
        return 0;
    }
    static char line[1 << 17], cmd[64], a1[1024], a2[1 << 16];
    while (fgets(line, sizeof line, stdin)) {
        a1[0] = a2[0] = 0;
        int n = sscanf(line, "%63s %1023s %65535s", cmd, a1, a2);
        if (n < 1) continue;
        if (!strcmp(cmd, "version")) {
            printf("ok c64run protocol=%d chips=%s\n", C64RUN_PROTOCOL, CHIPS_COMMIT);
        } else if (!strcmp(cmd, "init")) {
            // init [<rom folder>]: power on; the CPU stops at the reset vector, tick 0
            char dir[1024];
            rom_dir(n >= 2 ? a1 : NULL, argv[0], dir, sizeof dir);
            clear_sites();
            replaying = 0;
            replay_unknown = 0;
            last_sync_pc = 0;
            halted = 0;
            sample_stop = 0;
            maps = 0;
            coverage_reset();
            if (pin_file) { fclose(pin_file); pin_file = NULL; }
            if (record_file) { fclose(record_file); record_file = NULL; }
            if (sample_file) { fclose(sample_file); sample_file = NULL; }
            const char* problem = init(dir);
            if (problem) printf("err init: %s\n", problem); else status("ok");
        } else if (!strcmp(cmd, "quit")) {
            break;
        } else if (!need_ready()) {
            continue;
        } else if (!strcmp(cmd, "status")) {
            status("ok");
        } else if (!strcmp(cmd, "ram-load")) {
            // ram-load <file>: 64 KiB into RAM (the RAM view)
            uint8_t* b = read_file(a1, 0x10000);
            if (b) { memcpy(sys.ram, b, 0x10000); free(b); printf("ok\n"); } else printf("err ram-load: cannot read 65536 bytes from %s\n", a1);
        } else if (!strcmp(cmd, "ram-dump")) {
            printf(write_file(a1, sys.ram, 0x10000) ? "ok\n" : "err ram-dump: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "write")) {
            // write <addr hex> <bytes hex>: into RAM (the RAM view)
            unsigned addr;
            size_t len = strlen(a2);
            if (sscanf(a1, "%x", &addr) != 1 || len % 2) { printf("err write: give an address and hex bytes\n"); continue; }
            for (size_t i = 0; i < len / 2; i++) sys.ram[(addr + i) & 0xFFFF] = (uint8_t)hexbyte(a2 + 2 * i);
            printf("ok %zu\n", len / 2);
        } else if (!strcmp(cmd, "peek")) {
            // peek <addr hex> <count>: RAM bytes (the RAM view) as hex
            unsigned addr, count;
            if (sscanf(line, "%*s %x %u", &addr, &count) != 2 || count > 4096) { printf("err peek: give an address and 1-4096\n"); continue; }
            printf("ok ");
            for (unsigned i = 0; i < count; i++) printf("%02x", sys.ram[(addr + i) & 0xFFFF]);
            printf("\n");
        } else if (!strcmp(cmd, "regs")) {
            // regs <a> <x> <y> <s> <p> (hex)
            unsigned a, x, y, s, p;
            if (sscanf(line, "%*s %x %x %x %x %x", &a, &x, &y, &s, &p) != 5) { printf("err regs: give a x y s p in hex\n"); continue; }
            sys.cpu.A = a; sys.cpu.X = x; sys.cpu.Y = y; sys.cpu.S = s; sys.cpu.P = p;
            status("ok");
        } else if (!strcmp(cmd, "goto")) {
            // goto <pc hex>: continue at pc, at an opcode fetch (the "prefetch" of m6502.h)
            unsigned pc;
            if (sscanf(a1, "%x", &pc) != 1 || !(pins & M6502_SYNC)) { printf("err goto: give a pc, at an opcode fetch (run-sync first)\n"); continue; }
            pins = M6502_SYNC | M6502_RW;
            M6502_SET_ADDR(pins, pc);
            M6502_SET_DATA(pins, mem_rd(&sys.mem_cpu, pc));
            m6502_set_pc(&sys.cpu, pc);
            last_sync_pc = pc;
            // The prefetch is the opcode fetch at pc: it does not pass through tick.
            if (coverage_armed_pc && pc == coverage_pc) { coverage_armed_pc = 0; coverage_start(pc); }
            if (coverage_on) cover(pc, 1, 1);
            status("ok");
        } else if (!strcmp(cmd, "run")) {
            // run <tick>: run to the absolute tick (a tick in the past does nothing)
            const unsigned long long target = strtoull(a1, NULL, 10);
            while (ticks < target && !halted) tick();
            status("ok");
        } else if (!strcmp(cmd, "run-sync")) {
            // run-sync: run to the next opcode fetch
            do tick(); while (!(pins & M6502_SYNC) && !halted);
            status("ok");
        } else if (!strcmp(cmd, "run-pc")) {
            // run-pc <pc hex> <until tick>: run to the next opcode fetch at pc
            unsigned pc;
            const unsigned long long until = strtoull(a2, NULL, 10);
            if (sscanf(a1, "%x", &pc) != 1) { printf("err run-pc: give a pc and a tick\n"); continue; }
            do tick(); while (!((pins & M6502_SYNC) && M6502_GET_ADDR(pins) == pc) && ticks < until && !halted);
            status((pins & M6502_SYNC) && M6502_GET_ADDR(pins) == pc ? "ok reached" : "ok not-reached");
        } else if (!strcmp(cmd, "run-reads")) {
            // run-reads <pc hex> <addr hex> <n> <until tick>: run until the site has n reads
            unsigned pc, addr;
            unsigned long long count, until;
            if (sscanf(line, "%*s %x %x %llu %llu", &pc, &addr, &count, &until) != 4) { printf("err run-reads: give a site, a count and a tick\n"); continue; }
            watch_pc = pc;
            watch_addr = addr;
            watch_count = count;
            watch_site = NULL;
            for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].addr == addr) watch_site = &sites[i];
            watch_hit = watch_site && watch_site->count >= count;
            while (!watch_hit && ticks < until && !halted) tick();
            watch_count = 0;
            watch_site = NULL;
            status(watch_hit ? "ok reached" : "ok not-reached");
        } else if (!strcmp(cmd, "reads")) {
            // reads <pc hex> <addr hex>: the read count of a site
            unsigned pc, addr;
            if (sscanf(line, "%*s %x %x", &pc, &addr) != 2) { printf("err reads: give a site\n"); continue; }
            uint64_t count = 0;
            for (int i = 0; i < site_count; i++) if (sites[i].pc == pc && sites[i].addr == addr) count = sites[i].count;
            printf("ok count=%llu\n", (unsigned long long)count);
        } else if (!strcmp(cmd, "joy")) {
            // joy <port 1 mask> <port 2 mask> (hex): 1 up, 2 down, 4 left, 8 right, 10 fire
            unsigned j1, j2;
            if (sscanf(line, "%*s %x %x", &j1, &j2) != 2) { printf("err joy: give two masks\n"); continue; }
            c64_joystick(&sys, (uint8_t)j1, (uint8_t)j2);
            printf("ok\n");
        } else if (!strcmp(cmd, "key")) {
            // key <code hex> down|up: a key of the keyboard matrix; the code is ASCII as
            // chips maps it (A-Z, 0-9, space 20, return 0d, ...); shifted keys press SHIFT.
            // 11 and 12 are the left and right SHIFT alone, 5e the up arrow, ff RESTORE (NMI).
            unsigned code;
            if (sscanf(a1, "%x", &code) != 1 || (strcmp(a2, "down") && strcmp(a2, "up"))) { printf("err key: give a code and down or up\n"); continue; }
            if (!strcmp(a2, "down")) c64_key_down(&sys, (int)code);
            else {
                // chips releases a key in kbd_update, after its sticky time: one call
                // passes that time, the next one releases.
                c64_key_up(&sys, (int)code);
                kbd_update(&sys.kbd, 20000);
                kbd_update(&sys.kbd, 0);
            }
            printf("ok\n");
        } else if (!strcmp(cmd, "inputs")) {
            // inputs <addr|from-to,...>: the I/O addresses that record and replay handle
            memset(input_addr, 0, sizeof input_addr);
            int count = 0;
            for (char* part = strtok(a1, ","); part; part = strtok(NULL, ",")) {
                unsigned from, to;
                int fields = sscanf(part, "%x-%x", &from, &to);
                if (fields == 1) to = from;
                if (fields < 1 || (from & 0xF000) != 0xD000 || (to & 0xF000) != 0xD000 || to < from) { count = -1; break; }
                for (unsigned addr = from; addr <= to; addr++) { input_addr[addr & 0x0FFF] = 1; count++; }
            }
            if (count < 0) printf("err inputs: give addresses in $D000-$DFFF\n"); else printf("ok inputs=%d\n", count);
        } else if (!strcmp(cmd, "record")) {
            // record <file> | off: "site addr from value" when the value at a site changes;
            // off adds "end site addr count" for each site
            if (record_file) {
                for (int i = 0; i < site_count; i++) fprintf(record_file, "end %04x %04x %llu\n", sites[i].pc, sites[i].addr, (unsigned long long)sites[i].count);
                fclose(record_file);
                record_file = NULL;
            }
            if (!strcmp(a1, "off")) { printf("ok\n"); continue; }
            if (replaying) { printf("err record: a replay runs\n"); continue; }
            for (int i = 0; i < site_count; i++) sites[i].last = -1;
            record_file = fopen(a1, "w");
            if (record_file) printf("ok\n"); else printf("err record: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "site-map")) {
            // site-map <file> | off: "old new" pc pairs that a following replay uses
            maps = 0;
            if (!strcmp(a1, "off")) { printf("ok maps=0\n"); continue; }
            FILE* m = fopen(a1, "r");
            if (!m) { printf("err site-map: cannot read %s\n", a1); continue; }
            unsigned from, to;
            while (maps < MAX_SITES && fscanf(m, "%x %x", &from, &to) == 2) { map_from[maps] = from; map_to[maps] = to; maps++; }
            fclose(m);
            printf("ok maps=%d\n", maps);
        } else if (!strcmp(cmd, "replay")) {
            // replay <file>: the reads of input addresses at each site get the recorded values
            if (record_file) { printf("err replay: a recording runs\n"); continue; }
            const char* problem = load_replay(a1);
            if (problem) { printf("err replay: %s\n", problem); continue; }
            replaying = 1;
            replay_unknown = 0;
            int with = 0;
            for (int i = 0; i < site_count; i++) with += sites[i].nruns > 0;
            printf("ok sites=%d\n", with);
        } else if (!strcmp(cmd, "sites")) {
            // sites: each site as pc/addr:reads:ram|rom (in a replay also :recorded:misses)
            printf("ok unknown=%llu", (unsigned long long)replay_unknown);
            for (int i = 0; i < site_count; i++) {
                printf(" %04x/%04x:%llu:%s", sites[i].pc, sites[i].addr, (unsigned long long)sites[i].count, sites[i].rom ? "rom" : "ram");
                if (replaying) printf(":%llu:%llu", (unsigned long long)sites[i].total, (unsigned long long)sites[i].misses);
            }
            printf("\n");
        } else if (!strcmp(cmd, "sample")) {
            // sample <pc hex> <file> <addr:size,...> [<stop>] | off: RAM at each opcode fetch at
            // pc; with <stop>, every run command stops after that many samples ("ok halted")
            if (sample_file) { fclose(sample_file); sample_file = NULL; }
            if (!strcmp(a1, "off")) { printf("ok samples=%llu\n", (unsigned long long)samples); continue; }
            char path[1024], ranges[1024];
            unsigned pc;
            unsigned long long stop = 0;
            if (sscanf(line, "%*s %x %1023s %1023s %llu", &pc, path, ranges, &stop) < 3) { printf("err sample: give a pc, a file and ranges\n"); continue; }
            sample_stop = stop;
            halted = 0;
            sample_ranges = 0;
            for (char* part = strtok(ranges, ","); part && sample_ranges < 16; part = strtok(NULL, ",")) {
                unsigned from, size;
                if (sscanf(part, "%x:%u", &from, &size) == 2 && size >= 1 && size <= 4096) { sample_from[sample_ranges] = from; sample_size[sample_ranges] = size; sample_ranges++; }
            }
            sample_pc = pc;
            samples = 0;
            sample_file = fopen(path, "w");
            if (sample_file) printf("ok ranges=%d\n", sample_ranges); else printf("err sample: cannot write %s\n", path);
        } else if (!strcmp(cmd, "pin")) {
            // pin <file> <addr:size,...> | off: at each sample, the next line of <file> into
            // the ranges (give it before sample)
            if (pin_file) { fclose(pin_file); pin_file = NULL; }
            if (!strcmp(a1, "off")) { printf("ok pinned=%llu\n", (unsigned long long)pinned); continue; }
            char ranges[1024];
            if (sscanf(line, "%*s %1023s %1023s", a1, ranges) != 2) { printf("err pin: give a file and ranges\n"); continue; }
            pin_ranges = 0;
            for (char* part = strtok(ranges, ","); part && pin_ranges < 16; part = strtok(NULL, ",")) {
                unsigned from, size;
                if (sscanf(part, "%x:%u", &from, &size) == 2 && size >= 1 && size <= 4096) { pin_from[pin_ranges] = from; pin_size[pin_ranges] = size; pin_ranges++; }
            }
            pinned = 0;
            pin_file = fopen(a1, "r");
            if (pin_file) printf("ok ranges=%d\n", pin_ranges); else printf("err pin: cannot read %s\n", a1);
        } else if (!strcmp(cmd, "coverage")) {
            // coverage on | on-checkpoint | on-input | on-pc <pc hex> | off | status | <file>: start
            // now, at the next sample, at the first input read of code in RAM, at the first opcode
            // fetch at pc; stop; where the map started ("ok from tick=<n> pc=<hex>" or "ok
            // not-started"); or write the 65536-byte map
            unsigned pc;
            if (!strcmp(a1, "on")) { coverage_reset(); coverage_start(last_sync_pc); printf("ok\n"); }
            else if (!strcmp(a1, "on-checkpoint")) { coverage_reset(); coverage_armed = 1; printf("ok\n"); }
            else if (!strcmp(a1, "on-input")) { coverage_reset(); coverage_armed_input = 1; printf("ok\n"); }
            else if (!strcmp(a1, "on-pc")) {
                if (sscanf(a2, "%x", &pc) != 1 || pc > 0xFFFF) { printf("err coverage: give on-pc and a pc\n"); continue; }
                coverage_reset();
                coverage_armed_pc = 1;
                coverage_pc = (uint16_t)pc;
                printf("ok\n");
            }
            else if (!strcmp(a1, "off")) { coverage_on = coverage_armed = coverage_armed_input = coverage_armed_pc = 0; printf("ok\n"); }
            else if (!strcmp(a1, "status")) {
                if (coverage_started) printf("ok from tick=%llu pc=%04x\n", (unsigned long long)coverage_from_tick, coverage_from_pc);
                else printf("ok not-started\n");
            }
            else printf(write_file(a1, coverage, sizeof coverage) ? "ok\n" : "err coverage: cannot write %s\n", a1);
        } else if (!strcmp(cmd, "palette")) {
            // palette: the 16 colours as RRGGBB
            chips_display_info_t info = c64_display_info(&sys);
            const uint32_t* pal = info.palette.ptr;
            printf("ok");
            for (int i = 0; i < 16; i++) printf(" %02x%02x%02x", pal[i] & 0xFF, (pal[i] >> 8) & 0xFF, (pal[i] >> 16) & 0xFF);
            printf("\n");
        } else if (!strcmp(cmd, "frame")) {
            // frame: the visible screen as palette indices, "ok <width> <height> <base64>"
            chips_display_info_t info = c64_display_info(&sys);
            const int w = info.screen.width, h = info.screen.height, stride = info.frame.dim.width;
            const uint8_t* fb = info.frame.buffer.ptr;
            static uint8_t visible[512 * 320];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) visible[y * w + x] = fb[(info.screen.y + y) * stride + info.screen.x + x] & 0x0F;
            printf("ok %d %d ", w, h);
            print_base64(visible, (size_t)w * h);
            printf("\n");
        } else {
            printf("err unknown %s\n", cmd);
        }
    }
    if (record_file) {
        for (int i = 0; i < site_count; i++) fprintf(record_file, "end %04x %04x %llu\n", sites[i].pc, sites[i].addr, (unsigned long long)sites[i].count);
        fclose(record_file);
    }
    if (sample_file) fclose(sample_file);
    if (pin_file) fclose(pin_file);
    return 0;
}
