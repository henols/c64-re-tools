// capability-registry.ts
//
// WHY THIS FILE EXISTS (BACK-05): today, a tool name the ACTIVE backend does
// not advertise falls straight through vice-proxy.ts's CallToolRequestSchema
// override to its generic `Unknown tool: ${name}` fallback -- the exact same
// message a genuine typo gets. That is indistinguishable and unhelpful: a
// caller cannot tell "you misspelled this" from "this tool exists, but only
// on the other backend, for this specific reason." This module is the ONE
// authoritative place holding that per-backend capability data -- names,
// reason categories, reason text, and which backend actually provides each
// one -- so a future call site (the runtime refusal wired in plan 08-02, the
// generated support table in plan 08-03, the skill-text lint in plan 08-04)
// reads exactly one source rather than re-deriving or hand-copying it.
//
// WHAT NOT TO DO: do not hand-maintain a second copy of this data anywhere
// else in the repo (D-E; see CLAUDE.md's "re-deriving a cross-cutting seam
// locally" anti-pattern). If a consumer needs this data in a different
// shape, import CAPABILITY_REGISTRY and reshape it there -- never re-type
// the 26 entries or their reasons from memory.
//
// SECURITY POSTURE: this module is a READ-ONLY MESSAGE-TEXT LOOKUP and is
// NEVER an authorization boundary. DENY_LIST (vice.ts) remains the only
// refusal in this tree that is a security control; that check runs first, at
// every call site, and this module never overrides or duplicates it. Every
// string held here is already public: it names only information already
// published in docs/stock-vice-parity.md and this public repository -- no
// credential, no secret, no host, no port, no path, and no tool name that is
// not already present in one of the two shipped manifests
// (tools-manifest.json, tools-manifest.stock.json).
//
// This is the exact shape vice.ts's DENY_LIST / denyListRefusalMessage()
// already established: one exported readonly array, one exported
// message-rendering function, keyed by hazard/reason shape rather than one
// wording reused for every entry -- because telling a caller the wrong
// reason shape for what is otherwise the same permanent refusal invites a
// pointless retry (that function's own doc comment makes the identical
// point).
//
// EXCLUDED, DELIBERATELY (see docs/stock-vice-parity.md and
// 08-RESEARCH.md's "Capability Delta Registry"):
//   - "vice_diagnose" and "vice_recycle" are NOT capability gaps: they are
//     synthetic, proxy-local tools registered on BOTH backends by
//     vice-proxy.ts's buildBackendAwareTool()/resolveAdvertisedToolDefinition()
//     synthetic-registration call sites, never listed in either raw manifest
//     JSON file. A naive set-difference over the two manifests misclassifies
//     them as a divergence; they are not one, and including them here would
//     be a factual error, not merely an omission.
//   - "initialize", "notifications_initialized", "tools_call", "tools_list"
//     are already refused by vice.ts's DENY_LIST, which runs strictly BEFORE
//     any capability-registry lookup and owns a different hazard shape
//     entirely (confused-deputy bypass, not a missing capability). They must
//     keep being owned there, not duplicated here.
//
// This module imports nothing at runtime -- the only import is a type-only
// import of ViceBackend, which is erased by Node's type-stripping -- so it
// has no transport, no filesystem, and no process dependency of its own.
import type { ViceBackend } from "./backend-detect.mts";

/**
 * Three reason categories, matching the distinctions the project's own docs
 * already draw (docs/stock-vice-parity.md SS A/B):
 *   - "hardware": no 1:1 opcode can ever exist because of a hardware or
 *     firmware property (a write-only register, per-read recomputation, no
 *     monitor command for a physical line). Permanent; nothing to build.
 *   - "descoped": theoretically buildable client-side (an opcode or
 *     equivalent already exists) but cut from v0.2.0 scope because no
 *     shipped skill calls it.
 *   - "stock-only-gain": the reverse direction -- stock has a native opcode
 *     the fork's custom HTTP API never exposed an equivalent RPC for.
 */
export type CapabilityCategory = "hardware" | "descoped" | "stock-only-gain";

/**
 * One row of capability data. `providedBy` names the backend that DOES have
 * the capability (never the backend refusing it). `reason` is one sentence
 * of user-facing prose ending in a full stop -- no planning identifier
 * (BACK-05, SKILL-01, DERIV-*, SHOT-*, GAIN-*, "Phase N") belongs in this
 * field; those are internal routing annotations, not something a caller
 * calling a tool by name should ever see. `alternative`, when present, names
 * a concrete route that exists on the OTHER backend today -- omit it rather
 * than inventing one where none exists.
 */
export interface CapabilityEntry {
  name: string;
  category: CapabilityCategory;
  providedBy: ViceBackend;
  reason: string;
  alternative?: string;
}

const KEYBOARD_ALTERNATIVE =
  "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, " +
  "and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly " +
  "will not see buffer injection.";

/**
 * The 26-entry capability delta: every tool one backend advertises that the
 * other genuinely does not, after excluding registration artifacts
 * (vice_diagnose/vice_recycle) and DENY_LIST's own four meta-tools -- see
 * the header comment above and 08-RESEARCH.md's "Capability Delta Registry"
 * for the full accounting this array is derived from.
 */
export const CAPABILITY_REGISTRY: readonly CapabilityEntry[] = [
  // --- hardware (6), providedBy: fork -------------------------------------
  {
    name: "vice_sid_get_state",
    category: "hardware",
    providedBy: "fork",
    reason:
      "SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes " +
      "no SID read command.",
  },
  {
    name: "vice_keyboard_matrix",
    category: "hardware",
    providedBy: "fork",
    reason:
      "The binary monitor's KEYBOARD_FEED (0x72) only injects PETSCII buffer text; the emulator " +
      "recomputes CIA port B from its own keyboard array on every read, so there is no wire " +
      "command that can drive the raw matrix.",
    alternative: KEYBOARD_ALTERNATIVE,
  },
  {
    name: "vice_keyboard_restore",
    category: "hardware",
    providedBy: "fork",
    reason:
      "RESTORE pulses the NMI line directly; it is not part of the keyboard matrix, and " +
      "KEYBOARD_FEED has no way to produce it.",
    alternative: KEYBOARD_ALTERNATIVE,
  },
  {
    name: "vice_keyboard_chord",
    category: "hardware",
    providedBy: "fork",
    reason:
      "KEYBOARD_FEED injects a whole string at a time; it has no primitive for holding multiple " +
      "keys down together for a span of frames.",
    alternative: KEYBOARD_ALTERNATIVE,
  },
  {
    name: "vice_keyboard_key_press",
    category: "hardware",
    providedBy: "fork",
    reason:
      "KEYBOARD_FEED has no hold/release primitive -- it injects a complete string, not an " +
      "individual key-down event.",
    alternative: KEYBOARD_ALTERNATIVE,
  },
  {
    name: "vice_keyboard_key_release",
    category: "hardware",
    providedBy: "fork",
    reason:
      "KEYBOARD_FEED has no hold/release primitive -- it injects a complete string, not an " +
      "individual key-up event.",
    alternative: KEYBOARD_ALTERNATIVE,
  },

  // --- descoped (18), providedBy: fork -------------------------------------
  {
    name: "vice_disk_detach",
    category: "descoped",
    providedBy: "fork",
    reason:
      "No detach opcode exists on the stock binary monitor; attaching a different disk image " +
      "covers the same workflow.",
  },
  {
    name: "vice_disk_read_sector",
    category: "descoped",
    providedBy: "fork",
    reason:
      "Reading a sector would require parsing the .d64 file client-side rather than calling a " +
      "live-drive opcode, and no shipped skill calls it.",
  },
  {
    name: "vice_display_screenshot",
    category: "descoped",
    providedBy: "fork",
    reason:
      "The client-side PNG encoder for the INDEXED8 framebuffer DISPLAY_GET returns was descoped " +
      "because no shipped skill calls it.",
  },
  {
    name: "vice_display_get_dimensions",
    category: "descoped",
    providedBy: "fork",
    reason: "Descoped alongside vice_display_screenshot -- no shipped skill calls it.",
  },
  {
    name: "vice_backtrace",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls it.",
  },
  {
    name: "vice_checkpoint_group_add",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls any checkpoint-group tool.",
  },
  {
    name: "vice_checkpoint_group_create",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls any checkpoint-group tool.",
  },
  {
    name: "vice_checkpoint_group_list",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls any checkpoint-group tool.",
  },
  {
    name: "vice_checkpoint_group_toggle",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls any checkpoint-group tool.",
  },
  {
    name: "vice_checkpoint_set_ignore_count",
    category: "descoped",
    providedBy: "fork",
    reason:
      "No native wire ignore-count exists; the only implementation would require resuming the " +
      "machine on every ignored hit, which the no-unrequested-resume policy forbids. " +
      "CHECKPOINT_INFO's reply still reports an existing ignore count read-only.",
  },
  {
    name: "vice_cia_set_state",
    category: "descoped",
    providedBy: "fork",
    reason:
      "The write half of a tool whose read half already ships on stock; no shipped skill calls " +
      "the write half.",
  },
  {
    name: "vice_vicii_set_state",
    category: "descoped",
    providedBy: "fork",
    reason:
      "The write half of a tool whose read half already ships on stock; no shipped skill calls " +
      "the write half.",
  },
  {
    name: "vice_sprite_set",
    category: "descoped",
    providedBy: "fork",
    reason:
      "The write half of a tool whose read half already ships on stock; no shipped skill calls " +
      "the write half.",
  },
  {
    name: "vice_memory_fill",
    category: "descoped",
    providedBy: "fork",
    reason: "No shipped skill calls it.",
  },
  {
    name: "vice_sid_set_state",
    category: "descoped",
    providedBy: "fork",
    reason:
      "SID writes work fine over MEM_SET at $D400-$D418 -- this is not a hardware loss, only " +
      "reads are write-only in hardware. It is simply not implemented because no shipped skill " +
      "calls it.",
  },
  {
    name: "vice_machine_config_get",
    category: "descoped",
    providedBy: "fork",
    reason:
      "Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist " +
      "subset that never shipped on stock.",
  },
  {
    name: "vice_machine_config_set",
    category: "descoped",
    providedBy: "fork",
    reason:
      "Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist " +
      "subset that never shipped on stock.",
  },
  {
    name: "vice_joystick_tap",
    category: "descoped",
    providedBy: "fork",
    reason:
      "Requires running the machine for a measured hold-then-release interval, which depends on " +
      "timing infrastructure; not yet built, and no shipped skill calls it.",
  },

  // --- stock-only-gain (2), providedBy: stock ------------------------------
  {
    name: "vice_execution_until_return",
    category: "stock-only-gain",
    providedBy: "stock",
    reason: "The fork's custom HTTP API has no equivalent RPC; this is the native EXECUTE_UNTIL_RETURN opcode.",
  },
  {
    name: "vice_registers_available",
    category: "stock-only-gain",
    providedBy: "stock",
    reason: "The fork has no equivalent enumeration call; this is the native REGISTERS_AVAILABLE opcode.",
  },
];

/**
 * Plain name-keyed lookup over CAPABILITY_REGISTRY. `name` is untrusted
 * `request.params.name` from the wire: it is used ONLY as an equality
 * comparison value below. Never interpolate it into a path, a command, or
 * anything executed.
 */
export function capabilityEntryFor(name: string): CapabilityEntry | undefined {
  return CAPABILITY_REGISTRY.find((entry) => entry.name === name);
}

/**
 * Renders the BACK-05 refusal for `name` on `activeBackend`, or `undefined`
 * when there is nothing to refuse -- mirroring denyListRefusalMessage()'s
 * keyed-by-hazard-shape contract (vice.ts).
 *
 * Returns `undefined` when:
 *   - no registry entry exists for `name` (a genuinely unknown tool name --
 *     a typo -- must still fall through to the generic "Unknown tool"
 *     message at the call site, not this function's wording); or
 *   - `entry.providedBy === activeBackend` (defensive: the active backend
 *     already advertises this tool, so a miss here is a genuine
 *     unknown-tool case, not a capability gap, and must not be
 *     misclassified as one).
 *
 * Otherwise renders one of three wordings, selected by `entry.category`:
 *   - "hardware": names the tool, states it is unrecoverable on
 *     `activeBackend`, gives `entry.reason`, then names `entry.providedBy`
 *     with the actionable `Set VICE_BACKEND=...`, then `entry.alternative`
 *     when present. No "wait for a later phase" framing -- none is coming
 *     for a hardware loss, but a stock route may still exist and must be
 *     named here, since this is where the caller actually reads it.
 *   - "descoped": names the tool, states it is not implemented on
 *     `activeBackend`, gives `entry.reason`, then `entry.providedBy` and
 *     `Set VICE_BACKEND=...`, then `entry.alternative` when present. The
 *     literal token "unrecoverable" must NEVER appear in this wording: a
 *     reader told "not supported" for both a hardware loss and a merely
 *     unbuilt tool cannot tell which one is worth filing an issue about.
 *   - "stock-only-gain": names the tool, states it is not implemented on the
 *     fork backend specifically, gives `entry.reason`, then
 *     `Set VICE_BACKEND=stock`.
 */
export function capabilityRefusalMessage(
  name: string,
  activeBackend: ViceBackend,
): string | undefined {
  const entry = capabilityEntryFor(name);
  if (!entry) return undefined;
  if (entry.providedBy === activeBackend) return undefined;

  // `alternative` is rendered in EVERY branch that has one. It used to be
  // read only inside the "descoped" branch, which made the field dead at
  // runtime: all five entries that carry an alternative are category
  // "hardware", and no "descoped" entry has one. The generated support
  // table, the skill playbooks and README all printed the stock route while
  // the runtime refusal -- the one surface BACK-05 exists for -- dropped it.
  // Do not re-scope this back into a single branch.
  const alt = entry.alternative ? ` ${entry.alternative}` : "";

  if (entry.category === "hardware") {
    return (
      `${entry.name} is unrecoverable on the ${activeBackend} backend: ${entry.reason} ` +
      `Use the ${entry.providedBy} backend instead (Set VICE_BACKEND=${entry.providedBy}).${alt}`
    );
  }

  if (entry.category === "descoped") {
    return (
      `${entry.name} is not implemented on the ${activeBackend} backend: ${entry.reason} ` +
      `Use the ${entry.providedBy} backend instead (Set VICE_BACKEND=${entry.providedBy}).${alt}`
    );
  }

  // category === "stock-only-gain": only reachable with activeBackend ===
  // "fork" and entry.providedBy === "stock", since the same-backend guard
  // above already excluded the activeBackend === "stock" case.
  return (
    `${entry.name} is not implemented on the fork backend: ${entry.reason} ` +
    `Use the stock backend instead (Set VICE_BACKEND=stock).${alt}`
  );
}
