# Phase 34: The Host-Tool Execution Seam — Decisions

**No `/gsd-discuss-phase` ran for Phase 34.** `34-01` through `34-06`'s own plan text each
recorded a planner assumption (`A-01` through `A-14`) where a discuss-phase would normally
have produced a checkpoint decision. This document is their consolidated, referenced home —
the reason it exists rather than a `CONTEXT.md` (the discuss-phase artifact this phase never
got). Part 1 records `SEAM-07`'s JVM lifetime binding; Part 2 consolidates every `A-` id.

---

## Part 1 — SEAM-07: the JVM lifetime binding

```
JVM_BINDING: per-invocation
JVM_STARTUP_MS_RANGE: 12600-17400
JVM_STARTUP_MS_OBSERVED: 12407, 11160
COMPARABLE_PROJECTS: 4
JVM_REVERSAL_CONDITION: reverses to resident-socket when a single corpus pass over N=20 or
  more binaries spends more than P=30 percent of its wall-clock time inside JVM startup
```

### The binding, and why it is `per-invocation` rather than `deferred`

**`per-invocation`** — matching what plans `34-01`/`34-03` actually built: `ghidra.analyze`
spawns a fresh `analyzeHeadless` child process per `host_tool` request, exactly the way
`acme.build` spawns a fresh `acme` process per request. There is no resident JVM behind a
socket anywhere in this project's code today. `deferred` is not a legitimate answer here
precisely because a shipped, working implementation already embodies one of the two choices
— recording anything else would misdescribe what is on disk.

### Measurement

- `JVM_STARTUP_MS_RANGE: 12600-17400` — the **12.6-17.4 s** range `REQUIREMENTS.md`'s SEAM-07
  states, sourced there from a Phase-33-era measurement (`.planning/REQUIREMENTS.md` line
  150-151). This document does not re-derive it; it is cited, not re-measured.
- `JVM_STARTUP_MS_OBSERVED: 12407, 11160` — two of this project's own, independently taken
  numbers, at the low end of that range:
  - `12407` — `34-RESEARCH.md`'s own live probe this session, "`INFO Headless startup
    complete (12407 ms) (AnalyzeHeadless)`" (`.planning/phases/34-the-host-tool-execution-seam/34-RESEARCH.md`,
    Finding 2, Probe A).
  - `11160` — `GHIDRA_REFUSAL_MS` from plan `34-03`'s own live transcript, the ancestor
    dot-prefix refusal (`.planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md`,
    §1b and the Verdicts block). This is a **refusal**, not a completed analysis run, but it
    still pays the full JVM-startup cost before Ghidra's own `ProjectLocator` rejects the
    path — so it is a genuine, independently-measured JVM-startup-cost data point, at the low
    end of the cited range exactly like `12407` is.
- `COMPARABLE_PROJECTS: 4` — the count of independent comparable projects `REQUIREMENTS.md`'s
  SEAM-07 states converge on one resident JVM behind a localhost socket, structurally the
  same design as this project's own VICE broker. **MEDIUM confidence, survey-based rather
  than measured here**: `34-RESEARCH.md`'s own JVM-lifetime section corroborated the PATTERN
  by web search without obtaining a new timing number of its own — the convergence claim
  rests on that survey, not on a fresh measurement this document performed.

### The reversal condition

```
JVM_REVERSAL_CONDITION: reverses to resident-socket when a single corpus pass over N=20 or
  more binaries spends more than P=30 percent of its wall-clock time inside JVM startup,
  measured as sum(observed "Headless startup complete" milliseconds across the pass) divided
  by the pass's total elapsed wall-clock time.
```

`N=20` and `P=30` are this document's own chosen thresholds — a corpus pass smaller than 20
binaries is not the "at scale" case SEAM-07's own framing is about, and 30% of wall-clock
time spent purely on JVM class-loading and SSL/RNG init (rather than on any actual analysis)
is the point at which the fixed 12.6-17.4 s tax per binary stops being a rounding error next
to the 34-RESEARCH.md-documented multi-minute Ghidra analysis runs and starts being the
dominant cost. Both are mechanically checkable from a committed pass script's own timing
output: sum every `Headless startup complete (N ms)` line the pass observes, divide by the
pass's own measured start-to-finish wall-clock time, and compare the ratio against `P`.

### What `34-RESEARCH.md` could NOT answer, recorded so they are not silently absorbed

- **Assumption A2 (unmeasured):** whether `-process` batch framing actually amortizes the
  measured 12.6-17.4 s JVM startup cost across a corpus item, rather than paying it once per
  binary regardless of batching. `34-RESEARCH.md`'s own Assumptions Log states this "would
  require a real multi-binary corpus and timing harness, out of this phase's scope." Neither
  this document nor any Phase 34 plan claims it as decided.
- **Assumption A3 (no published figure found):** the GitHub Actions cost of installing Ghidra
  plus a JDK. `34-RESEARCH.md`'s own web search "could not find a concrete published number."
  What WAS independently confirmed is the archive size: `ghidra.zip` at **569,445,154 bytes**
  (~543 MiB), matching `REQUIREMENTS.md`'s own "543 MiB" figure. Download and unpack time —
  not archive size — is the open unknown the reversal condition's own eventual CI-cost
  variant (should one be written) would need to measure directly, since no published number
  exists to cite.

Neither A2 nor A3 is claimed as decided by this document. The reversal condition above does
not depend on either — it depends only on this project's own observed per-invocation startup
cost, which is measured — but a future phase extending the reversal condition to a CI-cost
term would need to take A3's measurement itself, since none exists to inherit.

### Why Ghidra is not one of the stateless tools the owner's seed was framed around

`.planning/seeds/host-tool-executor.md`'s "Shape" section frames the seam around
**stateless** tools — `c1541`, `petcat`, `cartconv`, `acme` — each a short-lived process that
takes input, produces output, and exits with nothing left behind between invocations. Ghidra
is structurally different on three axes: it runs inside **a JVM with a persistent project
directory** (not a stateless argv-in/bytes-out call), a single analysis run can take
**multiple minutes** (not the sub-second turnaround the seed's other examples assume), and
its exports run to megabytes — past the control channel's **64 KiB** line cap
(`broker-control.mts`'s `MAX_LINE_BYTES`, exercised directly by plan `34-02`), which is why
the file-route-only design (`{ path, sha256, byteLength }`, never an inline payload) is
already forced regardless of which way this binding is decided. This is the reason SEAM-07
exists as a recorded decision at all, rather than an assumption silently inherited from the
stateless case the seed document was actually written for.

### The parallelism guarantee, under the chosen binding

Under **`per-invocation`** (the binding recorded above): two concurrent `ghidra.analyze`
invocations are **two independent operating-system processes**, each with its own **disjoint
per-run project directory** (`resolveGhidraProject()`'s per-`runId` reservation, plan
`34-03`) and **no shared lock** of any kind — `PER_RUN_DIR: distinct`, per plan `34-03`'s own
live-measured verdict in `.planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md`.
Neither invocation can observe or block the other; the only shared resource is host CPU/RAM,
not any Ghidra-internal state.

Under the reversal target, **`resident-socket`**: one long-lived JVM process would serialize
requests arriving over its own socket — the same design shape as this project's existing
VICE broker, one instance handling one client's binmon session at a time. Reversing to this
binding would change the per-run directory discipline from "cheap, freely parallel, never
contended" to "requests queue behind whichever run the resident process is already serving,"
and the reversing implementation would need its own claim/release discipline (structurally
the same shape `broker-control.mts`'s `acquire`/`release` pair already provides for VICE
instances) rather than assuming two callers can simply run concurrently the way they can
today.

---

## Part 2 — planner assumptions `A-01` through `A-14`

No `/gsd-discuss-phase` ran for Phase 34. The fourteen decisions below were made by the
planner inside each plan's own text and are consolidated here rather than left scattered
across six `PLAN.md` files. `A-01` and `A-02` resolve `34-RESEARCH.md`'s own Open Questions 1
and 2; `A-09` resolves its Open Question 3 and discharges Assumption A4 — the governing suite
for the migrated packer module is its colocated `packer-finding.test.mjs`, not
`skill-program-recon-cli.test.ts`, which its own header says covers a different script
(`derive.mjs`).

| ID | Decision | Reasoning | Reversibility |
|----|----------|-----------|----------------|
| A-01 | One `host_tool` control op carrying a typed `tool`/`args` payload, not one `ControlRequestKind` member per tool. | Keeps the two byte-exact `ControlRequestKind` tests' breakage to a single, deliberate edit per widening rather than one edit per future tool; mirrors `broker-control.mts`'s own D-15 precedent ("a field, not an eighth op") one level over. Resolves `34-RESEARCH.md`'s Open Question 1. | Reversible — splitting into per-tool ops later changes one dispatch branch, one narrowing function and two test literals; the control protocol is internal to a container-host pair shipping as one package version, so no published contract breaks and no data migrates. |
| A-02 | "Recorded" (SEAM-01's "invocation and its exit status recorded") means `exitStatus` on the response plus one structured broker-stderr line per invocation — not a persistent audit file. | The cheapest reading that satisfies the requirement's own wording literally; mirrors how `vice-broker.mts` already writes `process.stderr.write` diagnostics elsewhere. Resolves `34-RESEARCH.md`'s Open Question 2. | Reversible — a persistent audit file can be added later without touching the response shape any existing caller depends on. |
| A-03 | `host_tool` requests carry only workspace-relative paths, resolved and boundary-checked server-side; only RESULT paths cross through `containerPath()`. | Keeps the whole new module family off the five-member `hostpath.ts` consumer list by construction — the ROADMAP's own preferred shape — rather than by a widened list. | Costly — this is the mechanism SEAM-06's whole closed-consumer discipline rests on; changing it later means re-deriving every allowlist entry's path-handling contract, not a one-line edit. |
| A-04 | `host-tool.test.ts` (and every sibling host-bound module's test) imports the committed `resources/*.mjs` build artifact, not the unbuilt `.mts` source. | Matches `broker-state.test.ts`'s own established precedent for testing a host-bound module — the module must ship as compiled output the broker process actually runs. | Reversible — a test importing the unbuilt source instead is a mechanical swap with no design implication, if a future refactor ever removes the build step. |
| A-05 | The 64 KiB cap test cases live in a NEW file, `host-tool-transport.test.ts`, rather than extending `broker-control.test.ts`. | Lets plan `34-01` and plan `34-02` avoid both editing `broker-control.test.ts`, so the two plans can run in different waves with no merge conflict; `ci-suite-coverage.test.ts` already covers the directory, so no new CI step is needed for a new file here. | Reversible — a later consolidation into one file is a pure file-organization move with no behavioral change. |
| A-06 | `ghidra-project.mts` is a host-bound module (ships as `resources/ghidra-project.mjs`), and `host-tool.mts` reaches it via a VALUE import of the compiled `.mjs` artifact. | The dot-segment rule must be enforced where `analyzeHeadless` is actually spawned — inside the broker process — so the module enforcing it must ship as compiled output the broker can import; mirrors plan `34-01`'s own A-04 discipline one level over for a sibling module. | Costly — every future family member that needs to reach `hostpath`-adjacent logic inherits this same host-bound-sibling shape; reversing it means re-deriving the build-artifact wiring `build.ts`/`tsconfig.build.json` now encode. |
| A-07 | The Ghidra per-run project root is `<repoRoot>/tools/ghidra-runs/<runId>`. | `install-resources.ts`'s `installTargetDir(root) = join(root, "tools")` is already non-dot-prefixed and already inside the bind-mounted workspace — the only placement satisfying both Finding 2's every-segment dot rule and the requirement that a result path be translatable by `containerPath()`. `.vice-supervisor/` and `.planning/` are disqualified as ancestors at any depth. | Costly — the path is now baked into `resolveGhidraProject()`, its test suite, `.gitignore`'s `tools/ghidra-runs/` entry and the live evidence transcript; moving it touches all four in the same commit. |
| A-08 | The MCP-tree resolution ladder is EXTRACTED into `src/skills/c64-ram-capture/scripts/mcp-module.mjs`, not copied a second time into the migrated skill scripts. | `vsf-slice.mjs` already carried the three-rung ladder with a refusal naming every path tried; cross-skill relative imports are an established pattern in this tree (`c64-provenance-diff/scripts/diff-images.mjs` already imports from `c64-ram-capture/scripts/`), and `installer/scripts/sync-skills.mjs` preserves that layout on both distribution routes. | Costly — three production consumers (`vsf-slice.mjs`, `acme.mjs`, `packer-finding.mjs`) now share one module; re-duplicating it later means re-introducing the exact drift risk this extraction closed. |
| A-09 | `packer-finding.mjs`'s governing test is its colocated `packer-finding.test.mjs`, NOT `skill-program-recon-cli.test.ts` (whose own header says it covers `derive.mjs`). | Direct inspection: `packer-finding.test.mjs` is the only file in the repository, other than the module itself, that names `probeUnp64`/`runUnp64`. Resolves `34-RESEARCH.md`'s Open Question 3 and discharges its Assumption A4. | Reversible — this is a factual finding about which test governs, not a design choice; a future rename of either file does not change which suite actually exercises the module. |
| A-10 | The packer oracle (`unp64`) is NOT installed on this host (measured: `command -v unp64` returns nothing), so the oracle route's live path is not exercised in this phase's own live testing. | `packer-finding.mjs` already treats this as an expected, visible absence, with a named skip plus an always-runs case (`VICE_REQUIRE_UNP64`) that turns the absence into a hard failure when explicitly demanded. | Reversible — installing the oracle later simply lets the named skip stop skipping; no code path assumes its absence permanently. |
| A-11 | The whole-tree external-spawn gate's discovered violation set is EXACTLY EMPTY after migration, with deliberately NO allowlist to add an entry to. | An allowlist is exactly how "no skill script spawns a host binary" decays into "…except these," one entry per milestone — the project's own Standing Constraint on repaired guards names this decay pattern explicitly. | Costly — a future tool that genuinely needs to spawn something the gate would flag requires migrating it onto the seam first, by design; there is no cheap escape hatch, which is the point. |
| A-12 | The external-spawn gate exempts a child-process call whose command resolves to the interpreter (`process.execPath`, directly or through a local declared from it) but does NOT exempt any bare command name. | `vsf-slice.mjs`'s own header already states the reasoning: the interpreter already running the script, invoked on a file inside this project's own two packages, reaches no external host binary and does not involve the seam at all. `vsf-slice.mjs` is the gate's real on-disk positive proof this exemption is not vacuous. | Costly — this is the single hardest distinction the gate's discovery predicate makes; loosening or tightening it risks either false negatives (a disguised host-binary spawn slips through) or false positives (a legitimate in-tree subprocess call is flagged). |
| A-13 | The host-tool family prefix is a UNION of three anchored prefixes — `host-tool`, `ghidra`, `dxa` — matched as `/^(host-tool\|ghidra\|dxa)(-[A-Za-z0-9-]*)?\.(ts\|mts)$/`, one floor rather than three. | The three prefixes name ONE family — the seam itself plus the two engines that reach host binaries through it — and a floor per prefix would pin two of them at zero today, which is a floor that cannot fail. Anchored at `^` so `anno-host-tool.ts` matches neither glob (asserted as a disjointness case in `hostpath-consumers.test.ts`). | Costly — the union-of-three-prefixes shape is now baked into a hand-pinned regex and its test suite; splitting it into per-prefix floors later means re-deriving three separate hand-pinned numbers instead of one relation. |
| A-14 | The host-tool family floor is `2 + 1 = 3`, expressed as that relation: the two modules plan `34-01` lands (`host-tool.mts`, `host-tool-client.ts`) plus the one plan `34-03` lands (`ghidra-project.mts`). | Test files are excluded by `topLevelProductionModules()` itself, so no `*.test.ts` inflates the count; the relation form keeps the arithmetic readable rather than presenting an unexplained bare number, following `ANNO_MODULE_FLOOR`'s own established convention. | Reversible — re-deriving the relation when the family legitimately grows is exactly the intended, expected maintenance path (raised, never lowered), not a design reversal. |

---

## Sources

- `.planning/REQUIREMENTS.md` — SEAM-06, SEAM-07's stated text and measurements.
- `.planning/ROADMAP.md` — Phase 34's Notes section, the Standing Constraint on repaired
  guards, and "the second trap, and it is the quieter one."
- `.planning/phases/34-the-host-tool-execution-seam/34-RESEARCH.md` — Pitfall 2, the JVM
  lifetime section, Assumptions A2/A3, the Environment Availability table, and Finding 2's
  `Headless startup complete (12407 ms)` observation.
- `.planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md` — the
  live, measured `GHIDRA_REFUSAL_MS`/`THIS_PROJECT_REFUSAL_MS` transcript, plan `34-03`.
- `.planning/phases/34-the-host-tool-execution-seam/34-01-PLAN.md` through `34-05-PLAN.md` —
  each plan's own recorded planner assumptions (`A-01` through `A-14`).
- `.planning/seeds/host-tool-executor.md` — the owner's original rule and the stateless-tool
  framing SEAM-07 departs from for Ghidra.
- `docs/phase33-reproducible-run-gate-findings.md` — the house shape this document follows
  for a machine-greppable verdict beside measured inputs and a stated reversal condition.
- `src/mcp/vice/broker-control.mts` — the in-repo convention of citing a `.planning/`-adjacent
  prose record from a source header for a decision recorded outside a test.
