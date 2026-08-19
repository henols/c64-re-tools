# Milestones

## v0.2.0 Switchable stock-VICE backend (Shipped: 2026-08-19)

**Phases completed:** 9 phases, 87 plans, 218 tasks
**Requirements:** 51/51 in-scope satisfied (17 cut wholesale 2026-08-17)
**Git range:** `669a7ce` → `HEAD` (696 commits since `v0.1.10`)
**Changed:** 448 files, +133,229 / −736 lines (151 files / +53,857 outside `.planning/`)
**Timeline:** 8 days (2026-08-11 → 2026-08-19)
**Final audit:** round 4, status `tech_debt` — no blockers, Nyquist fully compliant
**Known deferred items at close:** 13 (see STATE.md → Deferred Items)

**Delivered:** the plugin's tool surface no longer requires a custom, non-upstream
VICE fork. A second, project-selectable backend drives stock upstream VICE through
its binary monitor, and the two backends are honest with the user about the three
capabilities stock provably cannot have.

**Key accomplishments:**

- **Corrected the protocol ground truth before building on it.** Fixed four verified
  factual errors and a 3-to-5 unsolicited-event undercount across the normative
  documents, then extended the binary-monitor probe from 6 to 13 checks and ran it
  against both a genuine stock VICE 3.9 and the fork's 3.10 — resolving all five
  UNVERIFIED items with recorded evidence rather than inference.

- **Built a correctly-demultiplexed stock backend connection.** Request-id-first
  demux with a duplicate-reply ring and socket-lifecycle rejection distinguishable
  from timeout, so the five unsolicited event types (two of which share a response
  type with a legitimate command reply) can never resolve a pending request. Backed
  by broker-enforced `monitor_claim`/`monitor_release`, which refuses a conflicting
  claim *by name* before a second binmon `connect()` — the one that would otherwise
  be indistinguishable from a wedge — is ever attempted.

- **Ported every 1:1 tool and built the ten the skills need that stock lacks.**
  38 tools now ship on the stock manifest against the fork's 62: memory, registers,
  checkpoints, execution and machine control direct on the wire; plus a client-side
  6510 disassembler whose output reassembles through a real ACME 0.97 to exactly the
  original bytes across all 256 opcodes, memory search/compare, a symbol store, and
  VIC-II/CIA/sprite state decoders that report six internal-only fields as
  `{available:false, reason}` instead of a plausible-looking zero.

- **Made unavailable capabilities fail honestly instead of silently wrong.** A
  26-entry capability registry, wired strictly after `DENY_LIST`, answers a call to
  an unadvertised tool by naming the capability, the reason, and which backend
  provides it. The three proven-unrecoverable tools (`vice_sid_get_state`,
  `vice_keyboard_matrix`, `vice_keyboard_restore`) are named at their point of use in
  the playbooks, and `docs/tool-support.md` is generated from both manifests with a
  byte-identity drift guard rather than maintained by hand.

- **Cut 17 requirements against a single measured test**, not a judgment call: does a
  shipped skill call this tool, or does something a skill calls depend on it?
  Measured by diffing the six skills' actual `vice_*` usage against both manifests.
  Phase 6 was removed wholesale. Each cut names its requirements, which stay in the
  archive marked `CUT` with rationale.

- **Proved the finish line end-to-end, after it failed once.** Phase 8.1 ran the
  install-to-RAM-capture walkthrough that had only ever been claimed — and it
  falsified the claim, exposing a real defect (stock `x64sc` boots with
  `Drive8Type=0`, unfixable by any MCP tool). Phase 8.2 fixed the launch argv, and
  the re-run reached a verified 65536-byte capture against a broker-launched genuine
  `/usr/bin/x64sc`.

**Archived:**
- [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
- [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
- [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md) (round 4, plus rounds 1-3 verbatim)

---
