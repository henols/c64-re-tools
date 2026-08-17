---
phase: 05
phase_name: skill-critical-derived-tools
audit_date: 2026-08-18
auditor: gsd-security-auditor
asvs_level: 1
threats_total: 87
threats_closed: 87
threats_open: 0
dispositions:
  mitigate: 74
  accept: 8
  not_applicable: 5
unregistered_flags: 1
warnings: 5
verdict: SECURED
---

# Phase 05 Security Audit — Skill-Critical Derived Tools

First security audit in this project's history. No prior phase carries a `*-SECURITY.md`, so
this file also establishes the accepted-risks log that later phases append to.

## Scope and method

All 13 `*-PLAN.md` files in `.planning/phases/05-skill-critical-derived-tools/` carry a
`<threat_model>` block. Every threat in every register was extracted (87 total) and verified
against the code as it exists on `main` at commit `f4c2b13` — not against SUMMARY claims.

Adversarial stance: every mitigation was assumed absent until a grep match or an executed
probe proved it present at the right location. The two highest-value controls
(workspace containment on label-file loads, and the derived-tool/`rewriteArguments()` seam)
were verified by **running the code**, not by reading it.

No `## Threat Flags` section exists in any of the 13 SUMMARY files, and no `<config>` block
exists in any plan. `asvs_level: 1` is taken from the plans' own "ASVS L1 applicability"
sections; `block_on` defaults to `open`.

Calibration: local developer tool driving an emulator on the user's own machine. The realistic
adversary is a malicious or malformed *input* — a crafted label file, a hostile path argument,
attacker-chosen emulator bytes being decoded — not a remote network attacker. `QUAL-03`
(network exposure of the emulator control plane) is known, owned and deferred in
`.planning/REQUIREMENTS.md` and is not re-reported here.

## Executed probes (not code reading)

### Probe 1 — workspace containment, both directions

`vice_symbols_load` was driven directly against a synthetic workspace whose root was reached
through a **symlink** (`linkws -> realws`), with `CLAUDE_PROJECT_DIR` pointed at the symlinked
spelling. Eight cases, real behaviour observed:

| Case | Argument | Observed | Correct? |
|------|----------|----------|----------|
| A | `/etc/passwd` | refused, "outside the workspace root" | yes |
| B | `../outside/secret.txt` | refused | yes |
| C | in-workspace symlink **file** → outside | refused, "resolves (via symlink) to ... outside" | yes |
| D | in-workspace symlink **directory** → outside | refused | yes |
| E | `labels.txt` (legit, relative) | loaded; `resolvedPath` = canonical `realws/labels.txt` | yes |
| F | absolute path through the **symlinked** root | loaded | yes (WR-05 fix works) |
| G | absolute path through the **canonical** root | refused | fails closed — see W-03 |
| H | `labels.txt/../../outside/secret.txt` | refused | yes |

Both directions hold: **no escape is permitted (A–D, H) and a symlinked workspace root no
longer refuses legitimate in-workspace files (E, F)**. `resolveLabelFilePath()` returns `real`
(`stock-symbols.ts:181`), the same path the containment check ran on, and `statSync`
(`:316`) / `readFileSync` (`:326`) / the reported `resolvedPath` (`:355`) all consume that one
canonical string. WR-08's check-then-use window is genuinely closed, and WR-05's
canonical-vs-non-canonical root comparison is genuinely fixed (`:154-169`).

### Probe 2 — derived tools never receive host-translated paths

The same probe was re-run with `HOST_WORKSPACE_PATH=/home/hostuser/project` and
`CONTAINER_WORKSPACE_PATH` set. `resolvedPath` stayed inside `CLAUDE_PROJECT_DIR` and never
contained the host value. Structurally: `vice-proxy.ts:3166-3176` routes every stock tool
through `stockDispatch.dispatchStock()` directly — `rewriteArguments()` (`vice-proxy.ts:1846`,
invoked at `:2889` inside `forwardToVice()`) is **not** in the derived-tool call path at all.
`CLAUDE.md`'s "derived tools must be intercepted before `forwardToVice()`" invariant is
satisfied by construction, not by ordering luck.

### Probe 3 — power-cycle resources and the deny-list

`tools-manifest.stock.json` advertises 34 tools; `tools-manifest.json` advertises 62. **Neither
manifest contains any resource-setting tool** (`m.tools.filter(t => /resource/i.test(t.name))`
returns `[]` on the fork manifest), so `MachineVideoStandard`, `VICIIModel` and
`MachinePowerFrequency` are unreachable from every tool this phase exposed — and from every
tool that exists today. `RESOURCE_SET` (0x52) is Phase 6 territory
(`stock-machine.ts:12-19`, `stock-protocol.ts:819`). `DENY_LIST` (`vice.ts:201-207`) is
unchanged by this phase, and none of the nine derived tools warrants an entry: all nine are
read-only, and the two that write nothing to the wire at all (`vice_symbols_load`,
`vice_symbols_lookup`) never open a monitor session.

## Threat verification

All 74 `mitigate` threats are CLOSED with located evidence. All 8 `accept` threats are recorded
in the accepted-risks log below (and their factual premises were independently checked). All 5
`n/a` (`*-SC`) supply-chain threats are confirmed: `package.json` `dependencies` is still
exactly `{@mastra/mcp, @mastra/core}` and `files[]` is still 44 entries.

### 05-01 — `vice_memory_search` / `vice_memory_compare` (DERIV-01)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-01-01 | Tampering | mitigate | `stock-memory-search.ts:132-133,312-314` (`parseAddress`, 0..0xffff); derived `range2End > 0xffff` refused before any send at `:329-334`; `end < start` at `:137`, `:319` |
| T-05-01-02 | DoS | mitigate | `MAX_PATTERN_BYTES` `:65`, enforced `:149`; pattern-longer-than-range `:153-157`; `mask.length !== pattern.length` `:168-172` |
| T-05-01-03 | DoS | mitigate | `DEFAULT_MAX_RESULTS`/`MAX_MAX_RESULTS` `:60-61`; `parseByteCount(..., {max})` `:180`, `:341`; scan stops at cap `:237-238`, `:416`; `truncated` on answer `:253`, `:432` |
| T-05-01-04 | Tampering | mitigate | `sidefx: false` hardcoded at all three `memGetBody` sites `:195,368,386`; wire-body assertions `stock-memory-search.test.ts:226,344` |
| T-05-01-05 | DoS | mitigate | zero code occurrences of `CommandType.ExitLoop`/`Exit`/`Continue` in the module (grep clean; only a comment in `stock-vicii.ts:54`) |
| T-05-01-06 | Tampering | mitigate | `mode:'snapshot'` refused by name at `:284-292`, before the first `send()` at `:371` |
| T-05-01-07 | Repudiation | mitigate | `identical: differences.length === 0 && !truncated` `:433`; `maxResults`/`maxDifferences` echoed `:250,432` |

### 05-02 — `vice_symbols_load` / `vice_symbols_lookup` (DERIV-04)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-02-01 | Info disclosure | mitigate | `resolveLabelFilePath()` `stock-symbols.ts:124-134`; **Probe 1 cases A, B, H** |
| T-05-02-02 | Info disclosure | mitigate | `realpathSync` + `isContained(real, realRoot)` `:136-169`; ENOENT distinguished `:140-142`; **Probe 1 cases C, D** |
| T-05-02-03 | DoS | mitigate | `:79-81` ceilings; `statSync` before `readFileSync` `:316-322`; line ceiling `:198-200`; symbol ceiling `:236-238` |
| T-05-02-04 | EoP | mitigate | imports `:47-54` contain neither `hostpath.ts` nor `stock-paths.ts`; `hostpath-consumers.test.ts:77,97,140`; behavioural `stock-dispatch.test.ts:2076-2109`; **Probe 2** |
| T-05-02-05 | Tampering | mitigate | load is a replace, not a merge: `installSymbolTable()` `:259-265` calls `setSymbolResolver()` unconditionally; audit fields `:353-362` |
| T-05-02-06 | Repudiation | mitigate | `symbolCount: 0` note `:363-367`; `REFUSED_FORMATS` `:88` refused by name `:292-297` |
| T-05-02-07 | Repudiation | mitigate | `derivedAnswer()` stamps `runState: "unknown"` — `stock-handler.ts:183-189` |

### 05-03 — `vice_vicii_get_state` (DERIV-05)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-03-01 | Tampering | mitigate | exactly one `memGetBody` site, `sidefx: false`, `stock-vicii.ts:290`; wire-body assertion `stock-vicii.test.ts:297` |
| T-05-03-02 | Repudiation | mitigate | `VICII_UNAVAILABLE_FIELDS` `:98`, answer built from registry `:239-241`; 6 `enum: [false]` pins in `tools-manifest.stock.json` (machine-counted) |
| T-05-03-03 | Repudiation | mitigate | `response.bytes.length !== VICII_LENGTH` (47) `:305`; decoder guard `:142` |
| T-05-03-04 | Tampering | mitigate | any unexpected key refused, zero sends, `:282` |
| T-05-03-05 | DoS | mitigate | zero `ExitLoop`/`Exit`/`Continue` code occurrences |
| T-05-03-06 | DoS | mitigate | fixed `VICII_BASE..VICII_END` range, no caller influence (tool takes no arguments) |
| T-05-03-07 | Repudiation | mitigate | field names + register citations in the module header; polarity carried in name (`spritePriorityBehindBackground`) |

### 05-04 — `vice_cia_get_state` (DERIV-05)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-04-01 | Tampering | mitigate | `sidefx: false` at the single per-chip `memGetBody` site `stock-cia.ts:567`; assertion over **every** call `stock-cia.test.ts:690` |
| T-05-04-02 | Repudiation | mitigate | read/write-side split named explicitly `stock-cia.ts:119-131`; pairing assertion `stock-cia.test.ts:615` |
| T-05-04-03 | Repudiation | mitigate | `CIA_UNAVAILABLE_FIELDS` `:116`, rendered `:494-496`; 5 `enum: [false]` pins in the manifest |
| T-05-04-04 | Repudiation | mitigate | active-low `=== 0` helper `:163-164` with a "never fix this to `=== 1`" header note |
| T-05-04-05 | Repudiation | mitigate | `length !== CIA_LENGTH` refusal naming the chip `:582-585`; decoder guard `:211-212` |
| T-05-04-06 | Tampering | mitigate | `cia` validated against `1`/`2` and their string forms, refusal at `:526`; unexpected key refused `:536` |
| T-05-04-07 | DoS | mitigate | zero `ExitLoop`/`Exit`/`Continue` code occurrences |
| T-05-04-08 | DoS | mitigate | at most two fixed 16-byte reads; `cia` can only narrow |

### 05-05 — `vice_sprite_get` / `vice_sprite_inspect` (DERIV-06)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-05-01 | Tampering | mitigate | pointer-table end `stock-sprites.ts:336`; sprite-data end `:632` — both refuse `> 0xffff` before the send at `:639` (SUMMARY correctly records these as unreachable-by-construction defence in depth) |
| T-05-05-02 | Tampering | mitigate | `sidefx: false` at all four sites `:277,304,346,639`; three common reads behind one shared `readSpriteContext()` `:264+`; per-call wire assertions `stock-sprites.test.ts:299,547` |
| T-05-05-03 | Tampering | mitigate | explicit integer `0..7` (`:202`), **not** `parseByteCount`, so `sprite: 0` is accepted |
| T-05-05-04 | Repudiation | mitigate | `spriteWindowNote()` `:164`, applied to screen base `:371` and per reported sprite `:464` |
| T-05-05-05 | Repudiation | mitigate | per-sprite multicolour from `$D01C` bit N `:444`; non-numeric legend `:104`; shared renderer `:497-534` |
| T-05-05-06 | Repudiation | mitigate | four exact-length guards: `:292` (47), `:319` (1), `:361` (8), `:651` (63) |
| T-05-05-07 | DoS | mitigate | four fixed-size reads; `sprite`/`sprite_number` can only narrow to one of eight |
| T-05-05-08 | DoS | mitigate | zero `ExitLoop`/`Exit`/`Continue` code occurrences |
| T-05-05-09 | DoS | mitigate | `format: 'png_base64'` refused by name `:600-604` before `readSpriteContext()` `:614`; zero-sends tests `stock-sprites.test.ts:509,521` |

### 05-06 — manifest + dispatch registration (search/compare/symbols)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-06-01 | DoS | mitigate | `package.json` `files[]` (44) contains `stock-memory-search.ts`, `stock-symbols.ts`, `stock-dispatch.ts`, `stock-derived.ts`; transitive-closure walk `scripts/check-npm-packages.mjs:95-130` |
| T-05-06-02 | Spoofing | mitigate | zero `forwardToVice(` occurrences in `stock-dispatch.ts` **code** lines (both hits are comments, `:19`, `:392`), gated at `stock-dispatch.test.ts:2284`; exactly one `dispatchStock(` call site in `vice-proxy.ts` (`:3170`) |
| T-05-06-03 | Tampering | mitigate | `tools-manifest.json` still 62 tools; `git log --since 2026-08-17 -- tools-manifest.json` is empty (fork manifest untouched by the whole phase) |
| T-05-06-04 | Repudiation | mitigate | `conformanceTest()` harness `stock-dispatch.test.ts:1619`, one case per stock tool, validated by `checkAgainstSchema()` (`stock-schema-check.ts:89`); completeness guard `:2305` |
| T-05-06-05 | Tampering | mitigate | `THROWING_ENSURE_LEASE` `stock-dispatch.test.ts:2343`, used by the symbol cases `:2055,2065,2069,2086` |
| T-05-06-06 | EoP | mitigate | `EXPECTED_IMPORTERS` still exactly five `hostpath-consumers.test.ts:77`; on-disk existence loop `:134`; behavioural half `stock-dispatch.test.ts:2076-2109`; **Probe 2** |
| T-05-06-07 | Tampering | mitigate | D-03 required-set/type parity gate `stock-dispatch.test.ts:151,167-188` |

### 05-07 — manifest + dispatch registration (chip state / sprites)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-07-01 | DoS | mitigate | `files[]` contains `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts`; regression list extended to all ten derived modules `scripts/check-npm-packages.mjs:73-89` |
| T-05-07-02 | Repudiation | mitigate | exactly **11** `enum: [false]` pins found by machine walk of `tools-manifest.stock.json` (6 VIC-II + 5 CIA), each with `required: ["available","reason"]`; validated against real answers by the conformance harness |
| T-05-07-03 | Spoofing | mitigate | same gates as T-05-06-02 |
| T-05-07-04 | Tampering | mitigate | fork manifest untouched (62 tools, no phase-05 commit) |
| T-05-07-05 | Repudiation | mitigate | address-dispatching stub throws on an unmapped start address / unexpected commandType `stock-dispatch.test.ts:2113-2126`, with `io` deliberately a non-zero id (3) so a regression to bank 0 cannot pass |
| T-05-07-06 | EoP | mitigate | `EXPECTED_IMPORTERS` = 5; `DERIVED_TOOL_MODULES` covers all nine derived tools `hostpath-consumers.test.ts:116-151`; none of the four tools takes a path argument |
| T-05-07-07 | Tampering | mitigate | `format` kept `type: "string"` with a narrowed enum; D-03 gate compares required sets and types only (`:167-188`) |

### 05-08 — skill-coverage CI gate and parity documentation

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-08-01 | Repudiation | mitigate | `scripts/check-skill-tool-coverage.mjs:268` (≥30 names), `:273` (≥6 dirs, each with a file read), positive controls `:276,280`; wired as a blocking CI step `.github/workflows/ci.yml:89` |
| T-05-08-02 | Repudiation | mitigate | absent-from-stock assertions `:222,228-230`; live-allowlist assertion `:237-240` |
| T-05-08-03 | Tampering | mitigate | only `readdirSync`/`readFileSync`/`statSync` imported `:25`; `vice-proxy.ts` and `vice.ts` read as text `:184,195`; zero `import()`/`require()`/`eval`/`spawn` of skill content |
| T-05-08-04 | DoS | mitigate | walk rooted at `.claude/skills/`, `node_modules` segment skipped `:50`, no symlink descent out of tree |
| T-05-08-05 | Info disclosure | mitigate | `docs/stock-vice-parity.md:93-96` splits VERIFIED (wire body) from ASSUMED (emulator read path); `R2000-16` recorded as an assumption `:196` |
| T-05-08-06 | Repudiation | mitigate | `vice_keyboard_restore` allowlisted with reason/route `check-skill-tool-coverage.mjs:164`; the ROADMAP discrepancy written into `docs/stock-vice-parity.md:206` and not silently rewritten |
| T-05-08-07 | DoS | **accept** | see accepted-risks log AR-1 |

### 05-09 — io-bank resolution for chip state (gap closure)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-09-01 | Info disclosure | mitigate | `resolveRequiredBank(..., "io", ...)` `stock-vicii.ts:285`, `stock-cia.ts:559`; `bank:{id,name}` pinned `enum: ["io"]` in both outputSchemas (verified by machine walk); live case `stock-live.test.ts:505-527` (`$01=$34`) |
| T-05-09-02 | Tampering | mitigate | zero literal `bank: 0x…`/`bank: <int>` in `stock-vicii.ts`/`stock-cia.ts`; ids come only from the emulator's `BANKS_AVAILABLE` catalog `stock-memory.ts:108-137,178-212`. **Declared grep gate is not a committed test — see W-02** |
| T-05-09-03 | DoS | mitigate | per-session `WeakMap` cache `stock-memory.ts:87-89,109-112`; "exactly one BanksAvailable" assertions `stock-cia.test.ts:716`, `stock-sprites.test.ts:294,543` |
| T-05-09-04 | Tampering | **accept** | see accepted-risks log AR-2 |
| T-05-09-05 | Repudiation | mitigate | answer records the memory view it was read through (`bank` field, required in both outputSchemas) |
| T-05-09-SC | Tampering | n/a | confirmed: `dependencies` = `{@mastra/mcp, @mastra/core}`, `files[]` = 44 |

### 05-10 — ram-bank resolution for sprites (gap closure)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-10-01 | Info disclosure | mitigate | VIC-fetched reads resolved through `ram` `stock-sprites.ts:346,639`; `dataBank` pinned `enum: ["ram"]` on both sprite outputSchemas; I/O-window note `:164,371,464` |
| T-05-10-02 | Tampering | mitigate | zero literal bank ids in `stock-sprites.ts`; both ids from `resolveRequiredBank()` `:264-275`. **Declared grep gate is not a committed test — see W-02** |
| T-05-10-03 | Repudiation | mitigate | legend constants `:89-104` matched to the emitted alphabet by the renderer tests |
| T-05-10-04 | DoS | mitigate | one extra `BANKS_AVAILABLE` per session; send-count assertions `stock-sprites.test.ts:294,543` |
| T-05-10-05 | Tampering | **accept** | see accepted-risks log AR-2 |
| T-05-10-SC | Tampering | n/a | confirmed unchanged |

### 05-11 — label-file path hardening (gap closure)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-11-01 | EoP / path traversal | mitigate | **the single most security-relevant change in the phase, verified by execution.** `resolveLabelFilePath()` returns `real` `stock-symbols.ts:181`; `statSync`/`readFileSync`/`resolvedPath` all consume that same string `:316,326,355`; **Probe 1 cases C, D refuse; E, F load** |
| T-05-11-02 | EoP (residual TOCTOU) | **accept** | see accepted-risks log AR-3 |
| T-05-11-03 | Tampering | mitigate | `query.address` echoes the parsed number, never the raw argument `:416-422` |
| T-05-11-04 | DoS | **accept** (already mitigated) | see AR-4; ceilings verified live at `:79-81,198-200,236-238,320-322` |
| T-05-11-05 | Info disclosure | **accept** | see accepted-risks log AR-5 |
| T-05-11-SC | Tampering | n/a | confirmed unchanged |

### 05-12 — CIA joystick/TOD honesty (gap closure)

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-12-01 | Spoofing (provenance) | mitigate | per-bit, per-port `confounded` derived from the DDR bytes `stock-cia.ts:247-250,343,348,373,375`; raw booleans preserved; chip-level note `:330` |
| T-05-12-02 | Spoofing (provenance) | mitigate | `fromBcd()` returns `null` on either nibble > 9 `:150-157`; key omitted and listed in `tod.invalidBcd` `:413-449`; `rawHex` always present `:394` |
| T-05-12-03 | Tampering | mitigate | every new field declared in `vice_cia_get_state`'s outputSchema; validated against the real answer by the conformance harness |
| T-05-12-04 | Info disclosure | **accept** | see accepted-risks log AR-6 |
| T-05-12-SC | Tampering | n/a | confirmed unchanged |

### 05-13 — parity docs and requirements reconciliation

| Threat ID | Category | Disp. | Evidence |
|-----------|----------|-------|----------|
| T-05-13-01 | Repudiation | mitigate | `docs/stock-vice-parity.md:93-96` VERIFIED/ASSUMED split; banking hazard + per-answer bank naming recorded in `.claude/skills/c64-program-recon/references/observation-hazards.md:92-95` |
| T-05-13-02 | Tampering | mitigate | commit `7bfae11` edits `.planning/REQUIREMENTS.md` with DERIV-05's premature mark **annotated rather than erased**, and the per-phase open count recomputed in the same edit |
| T-05-13-03 | Tampering | mitigate | **independently verified**: `git show 7bfae11 -- stock-dispatch.ts` filtered to non-comment lines is **empty** — the diff really is comment-only |
| T-05-13-04 | Info disclosure | **accept** | see accepted-risks log AR-7 |
| T-05-13-SC | Tampering | n/a | confirmed unchanged |

## Accepted risks log

Standing register. Later phases append; entries are removed only when the risk is actually
eliminated in code, never because it stopped being convenient.

| ID | Threat | Risk | Why accepted | Owner / revisit |
|----|--------|------|--------------|-----------------|
| AR-1 | T-05-08-07 | The blocking `check-skill-tool-coverage.mjs` CI step could fail for an unrelated reason and block every merge | The step has no network access, no dependency and no emulator requirement — it reads committed files and two committed manifests (`scripts/check-skill-tool-coverage.mjs:88-100,184,195`). `continue-on-error` would make it advisory, defeating the purpose. Spurious-block risk < silent-regression risk | Revisit only if it actually produces a false block |
| AR-2 | T-05-09-04, T-05-10-05 | `stock-live.test.ts` writes `$01` on a real emulator | **Premises independently verified:** file default-skipped without `VICE_LIVE_STOCK_BIN` (`:80-83`); emulator spawned by the test file with a per-run `XDG_CONFIG_HOME` scratch dir (`:163`) and killed in `after()`; monitor bound `ip4://127.0.0.1:<ephemeral>` only, never `0.0.0.0` (`:50-51,162,171`); `$01` restored to `$37` **inside a `finally`** (`:519-527`, `:791-792`) | Never CI-enabled; keep the 127.0.0.1 bind invariant |
| AR-3 | T-05-11-02 | Residual TOCTOU inside kernel path resolution: a component could in principle be swapped between `realpathSync()` and `readFileSync()` | Local developer-facing debug bridge reading a label file inside the developer's own workspace; the attacker would already need write access to that workspace. An `O_NOFOLLOW`/fd-based rewrite would change the tool's error surface for no realistic gain (D-05-19). The exploitable *string-level* window (WR-08) is closed — only the kernel-level one remains | Revisit if `vice_symbols_load` is ever reachable by a non-workspace-trusted caller |
| AR-4 | T-05-11-04 | Label-file resource ceilings unchanged by 05-11 | Already mitigated: 2 MiB / 50 000 lines / 20 000 symbols, each refusing with the observed value and the limit named (`stock-symbols.ts:79-81,198-200,236-238,320-322`) | None |
| AR-5 | T-05-11-05 | Refusal messages echo absolute local paths | Both paths are either caller-supplied or the workspace root; the consumer is the developer's own agent session. Echoing them is what makes a refusal actionable | Revisit if tool output is ever forwarded off-host |
| AR-6 | T-05-12-04 | New prose fields (`confoundedReason`, `notes`) | Describe C64 hardware behaviour and an observed DDR byte; carry no host paths, environment values or user data | None |
| AR-7 | T-05-13-04 | Added documentation prose | Describes C64 banking and this repo's own field names; no host path, credential or user data | None |

## Unregistered flags

One item of new attack surface appeared during implementation with no threat-model entry.

**UF-1 (WARNING) — the `bank` argument on `vice_memory_search` / `vice_memory_compare`.**
Added by the review-fix pass (WR-06, commit `e5cf367`), which had no plan and therefore no
`<threat_model>` of its own. It is genuinely new untrusted, model-generated input reaching
`resolveBank()` (`stock-memory.ts:148-160`) and thence the wire bank field of up to three
`MEM_GET` requests. 05-01's register predates it and does not mention it.

Audited independently: not a vulnerability. A non-`string` `bank` is refused
(`stock-memory.ts:156-158`); a string is lower-cased and looked up **only** in the emulator's
own `BANKS_AVAILABLE` catalog, with an unknown name refused rather than defaulted
(`:190-205`); the caller can therefore never inject an arbitrary wire id, and the ids
themselves are never hardcoded. The argument is declared `type: "string"`, optional, on both
tools' `inputSchema`, so the D-03 parity gate covers it. Logged for traceability, not as a
blocker.

## Warnings

Not blockers. Each is either a declared mitigation mechanism that is weaker in the repo than
in the plan text, or an open review finding that touches a declared control.

**W-01 (WARNING) — `## Threat Flags` was never emitted.** None of the 13 SUMMARY files contains
that section, so UF-1 above had to be found by diffing the review-fix commits against the
registers rather than read off a list. The executor pipeline should emit the section (even as
"none") so future audits do not depend on the auditor reconstructing it.

**W-02 (WARNING) — five declared "source gate" / "grep gate" mechanisms are not committed as
tests.** T-05-03-01, T-05-04-01, T-05-05-02, T-05-09-02 and T-05-10-02 each name a source-text
gate (`sidefx: true` absent; no literal `bank:` id; exactly-one-`memGetBody`-call-site). No
`readFileSync`-based source gate exists in `stock-vicii.test.ts`, `stock-cia.test.ts`,
`stock-sprites.test.ts` or `stock-memory-search.test.ts` — those greps ran once as plan
acceptance criteria and left nothing behind. The **primary** control in each case is committed
and non-vacuous (wire-body assertions over *every* call: `stock-cia.test.ts:690`,
`stock-sprites.test.ts:299,547`, `stock-vicii.test.ts:297`, `stock-memory-search.test.ts:226,344`),
and I verified by grep that the properties hold on `main` today. The gap is regression
protection for a *future* phase adding a read outside an exercised path. Each threat is CLOSED
on its primary mechanism; the declared second mechanism is absent.

**W-03 (informational) — the first containment check compares two non-canonical paths.**
`resolveLabelFilePath()` runs `isContained(resolved, root)` before either side is
canonicalised (`stock-symbols.ts:132`). Probe 1 case G shows the consequence: when the
workspace root is spelled through a symlink, a caller passing the **canonical** absolute path
to a legitimate in-workspace file is refused. This **fails closed** — it is a usability wart,
not an escape — and the plan text explicitly keeps the pre-realpath check for its clearer error
message. Noted because the same asymmetry is what WR-05 was about, in the other direction. Also
note `stock-dispatch.test.ts:2096` asserts `resolvedPath.startsWith(repoRootDir)`, which would
fail on a platform where the temp dir has a symlinked component (macOS `/private/tmp`); it
passes on Linux only incidentally.

**W-04 (informational, open review finding IN-01) — schema pin vs. wire spelling.** The
manifest pins `bank.name`/`dataBank.name` to lowercase `enum: ["io"]`/`["ram"]`, while
`resolveRequiredBank()` echoes the emulator's own spelling (`stock-memory.ts:206-211`). A future
VICE build reporting `IO`/`RAM` would make the answer violate its own declared outputSchema —
weakening T-05-09-01/T-05-10-01's schema-pin mechanism. It fails **loudly** (conformance
violation), not silently, and stock VICE 3.9 was live-verified to report lowercase
(`stock-live.test.ts:539`). Left as the review recorded it.

**W-05 (informational, open review finding IN-03) — the hostpath consumer gate sees only direct
static imports.** `stock-symbols.ts` does transitively reach `hostpath.ts`, via
`repo-root.ts` → `install-resources.ts:37`. That chain is benign — `install-resources.ts` uses
`hostPath()` only to deploy host launcher scripts, and never touches a tool argument — and
**Probe 2 confirms behaviourally** that no host translation is applied to the `path` argument.
T-05-02-04/T-05-06-06/T-05-07-06 are CLOSED on the behavioural evidence, not on the import gate
alone.

## Verdict

**SECURED — 87/87 threats resolved, `threats_open: 0`.**

74 `mitigate` threats CLOSED with located evidence; 8 `accept` threats recorded in the
accepted-risks log with their factual premises independently checked; 5 `n/a` supply-chain
threats confirmed (`dependencies` unchanged, `files[]` = 44). One unregistered flag (UF-1) and
five warnings, none of them ship-blocking.

The two controls that carried the phase's real risk — workspace containment on label-file loads
and the derived-tool/`rewriteArguments()` seam — were verified by executing the code against
adversarial inputs, not by reading it, and both hold in both directions.
