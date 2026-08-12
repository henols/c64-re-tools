## Conflict Detection Report

Mode: new. Precedence: ADR > SPEC > PRD > DOC (with 2 user-approved scope
overrides, recorded under RESOLVED).
Ingest set: 3 docs — 1 ADR, 1 SPEC, 1 DOC. 0 PRDs.
Cross-ref cycle check: PASS (1 doc-to-doc edge, depth 1, no cycles).
Locked decisions in set: 0 (the only ADR is `Status: proposed`).
Status: 0 blockers, 0 open warnings, 6 auto-resolved, 2 user-resolved 2026-08-11.
Cleared for routing.

### BLOCKERS (0)

None. No LOCKED decisions exist in the ingest set, so no LOCKED-vs-LOCKED
contradiction is possible. No cross-ref cycles. No UNKNOWN-type or low-confidence
classifications. No existing `.planning/` decisions to contradict (new mode;
`.planning/` holds only read-only codebase intel).

### WARNINGS (0)

None open. Both warnings raised by this ingest (W1 chip-state read-back, W2
binary-monitor request framing) were resolved by the user on 2026-08-11 and are
recorded in full under RESOLVED below.

### INFO (6)

[INFO] I1 — SPEC resolves ADR open questions (not a contradiction)
  Note: docs/roadmap-stock-vice.md §C flagged the cycle stopwatch as "unconfirmed"
    and "the #1 de-risk item" (the VICE manual was egress-blocked during
    research). docs/phase0-binmon-findings.md §1-§4 answers this from VICE source:
    no monotonic cycle register exists (e_Cycle 0x36 / e_Rasterline 0x35 are
    checkpoint-condition pseudo-registers, not elapsed time), and CPUHISTORY_GET
    0x86 carries a uint64 absolute clock per entry that serves as the stopwatch.
    Also resolved: no run-for-N-cycles command (§2), DISPLAY_GET is INDEXED8-only
    and needs api_version >= 2 (§3), and there is no pause-now opcode — EXIT 0xaa
    resumes, temp checkpoints stop (§4). Recorded as resolutions of open
    questions, not conflicts. Phase 0's analysis leg is complete.

[INFO] I2 — Cycle stopwatch is provisional pending an empirical probe
  Note: docs/phase0-binmon-findings.md §1 marks CPU history as a compile-time VICE
    feature. If the target x64sc lacks it, CPUHISTORY_GET errors or returns zero
    entries and the stopwatch is unavailable; stated fallbacks are per-instruction
    cost summation while single-stepping, or wall-clock. The probe
    (.claude/mcp/vice/probe-binmon.mjs) has not been run — this repo's container
    has no VICE and no display. Carried into intel as CON-stopwatch-via-cpuhistory
    (PROVISIONAL) and CON-probe-outstanding (OUTSTANDING). This gates the
    timing-tool design, not the ingest.

[INFO] I3 — Auto-resolved: SPEC opcode set supersedes the ADR's abbreviated list
  Note: docs/roadmap-stock-vice.md group A names checkpoints as
    "add/delete/list/toggle (0x11-0x15)" — four names for five opcodes.
    docs/phase0-binmon-findings.md §5 enumerates CHECKPOINT GET/SET/DELETE/LIST/
    TOGGLE 0x11-0x15 and adds REGISTERS_AVAILABLE 0x83, VICE_INFO 0x85,
    USERPORT_SET 0xb2, QUIT 0xbb, AUTOSTART 0xdd, plus the full error-code table.
    The two lists agree on every shared opcode value; the SPEC is a superset.
    Resolved as completion rather than contradiction — the SPEC's enumeration is
    recorded in constraints.md as CON-command-opcode-set.

[INFO] I4 — Auto-resolved: pause / run-until degradation is consistent across all three
  Note: The ADR flags "explicit pause-now" and run-until-N-cycles as group-C gaps
    needing a workaround; the SPEC confirms no pause opcode and no
    run-for-N-cycles command; the DOC grades both "approximate" (temp checkpoint
    for pause; detect crossing N via the CPU-history clock but cannot halt exactly
    at N). Same position at three levels of detail. No conflict. The DOC's
    additional point — that vice_cycles_stopwatch has no hardware reset, so
    atomic reset_and_read becomes client-side baseline math — extends the SPEC
    without contradicting it.

[INFO] I5 — Auto-resolved: low-level keyboard, ADR hedge narrowed by DOC
  Note: docs/roadmap-stock-vice.md §C says holds/matrix/NMI are "likely
    unsupported -> partial/degraded". docs/stock-vice-parity.md §A.2 confirms
    KEYBOARD_FEED 0x72 injects PETSCII text into the buffer only, and grades
    matrix/chord/key_press/release/restore an outright loss with type/petscii
    surviving. The DOC narrows a hedge in the same direction; recorded as the DOC
    sharpening the ADR, not overriding it.

[INFO] I6 — All three classifications are medium-confidence hybrids
  Note: No source carries frontmatter or a filename-convention type signal;
    all three were typed on content alone at medium confidence.
    roadmap-stock-vice.md was resolved to ADR despite competing SPEC signals
    (opcodes, framing) and DOC signals (filename "roadmap", phased plan) — it
    therefore held top precedence while being explicitly "proposed", which is what
    made W1 and W2 non-trivial. phase0-binmon-findings.md was resolved to SPEC
    despite narrative RESOLVED/VERIFY framing. stock-vice-parity.md was resolved
    to DOC despite citing opcodes, because they are evidence in a gap analysis
    rather than contracts. Both precedence questions this raised are now settled
    per-scope under RESOLVED below.

### RESOLVED (2)

Audit trail of user decisions. Not a severity level — these entries were WARNINGs
that the user closed. Each override is scoped to the stated subject only; the
default ADR > SPEC > PRD > DOC ordering still applies everywhere else.

[RESOLVED 2026-08-11] W1 — SID / chip-state read-back: DOC is authoritative
  Was: [WARNING] ADR (docs/roadmap-stock-vice.md, proposed) group B listed
    "VIC-II / SID / CIA state (memory-mapped I/O at $D000/$D400/$DCxx)" as a
    straightforward client-side derivation, while DOC (docs/stock-vice-parity.md)
    §A.1 showed SID registers $D400-$D418 are write-only in hardware and the state
    is unrecoverable, and §A.6 showed VIC-II/CIA internal state is not in the
    register map.
  Decision: docs/stock-vice-parity.md is AUTHORITATIVE on chip-state read-back.
    SID state read-back ($D400-$D418) is a HARD LOSS, not a client-side
    derivation. VIC-II / CIA internal state (raster-IRQ latch, timer latch vs.
    count, internal flip-flops) is PARTIAL — only what is in the readable register
    map is available. Client-side write-shadowing is recorded as an OPTIONAL
    MITIGATION for SID, explicitly not full parity: the client can shadow only the
    writes it issues, never the writes the running program makes. The ADR's
    group-B claim is superseded on this scope.
  Applied: decisions.md DEC-tool-triage-abc — SID moved to group C as a hard loss,
    VIC-II/CIA marked partial, superseded ADR text retained under "W1 amendment".
    constraints.md — new CON-sid-readback-hard-loss and
    CON-chip-internal-state-partial, both SETTLED. context.md §A.1 and §A.6 marked
    AUTHORITATIVE. DEC-doability-assessment carries a note that the 85-90% figure
    predates this amendment and was not re-derived.

[RESOLVED 2026-08-11] W2 — Binary-monitor wire format: SPEC is normative
  Was: [WARNING] ADR (docs/roadmap-stock-vice.md, proposed) Phase 1 described TCP
    framing as "STX 0x02, length, cmd, request-id, little-endian" — command type
    before request id, with no api_version field — while SPEC
    (docs/phase0-binmon-findings.md) §5 gave an 11-byte byte-offset table with
    request id before command type plus an api_version byte, derived from
    vice/src/monitor/monitor_binary.c.
  Decision: docs/phase0-binmon-findings.md is NORMATIVE on binary-monitor wire
    format. The 11-byte request header stands as specified: STX (0),
    api_version = 0x02 (1), body length (2-5, little-endian), request id (6-9,
    little-endian), command type (10), body (11+). The ADR's parenthetical field
    order is imprecise paraphrase and is superseded.
  Applied: constraints.md CON-wire-request-header and CON-wire-response-header
    marked SETTLED/normative; the inline conflict flag is removed and replaced
    with an explicit "superseded" note naming the ADR text not to implement
    against. decisions.md DEC-phased-delivery-plan carries a "W2 amendment"
    recording the superseded Phase-1 paraphrase.
