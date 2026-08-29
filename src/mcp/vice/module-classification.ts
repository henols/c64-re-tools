// module-classification.ts -- the ONE authoritative, committed record of
// which `r2000`-named modules are CAPABILITIES (things this project owns,
// which must survive the substrate swap under some name) and which are GLUE
// (things whose whole subject is the rented external analyser, and which go
// when it goes).
//
// WHY THIS FILE EXISTS (SEAM-02): a later milestone deletes the
// rented static-analysis integration -- CUT-01 sizes it at a net ~12.4k lines out
// of a 25,759-line family. The cheap way to drive that deletion is a name
// glob, and the name glob is wrong: ten of the sixteen non-test modules in
// the family implement things that have nothing to do with the analyser
// (C64 disk geometry, VIC-II/SID/CIA register bit layout, ACME identifier
// legality, a byte-coverage census, a confidence-grade vocabulary, a
// validated label round trip). Deleting those because of what they are
// called would take real capabilities with them, silently, inside a diff
// far too large to read. So the classification is recorded HERE, as data,
// BEFORE anything is deleted -- which is the only point at which it can be
// trusted, because a record written under deletion pressure is a record
// written by the deletion.
//
// A prose document would have done this job and gone stale with nothing
// failing. `module-classification.test.ts` is what makes this file an
// obligation instead: it enumerates the declared scope from disk and fails,
// naming the file, the moment a module in scope has no entry or an entry
// has no module.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the capability-or-glue
// verdict for every module in the declared enumeration scope, the BASIS
// each verdict rests on (cited consumers plus requirement ids), the
// symbols that must move out of a module before it may be deleted, and
// every deliberate scope exclusion. Nothing else in the repo may hold a
// second copy of this judgement; a consumer that needs it in a different
// shape imports MODULE_CLASSIFICATION and reshapes it there.
//
// THE DISCRIMINATOR (D-07), AND THE TRAP ITS WORDING SETS. A verdict is
// derived from what the module DOES, expressed as: a consumer that
// survives the substrate swap, OR a requirement id the module serves or
// implements. It is NEVER derived from the module's name.
//
//   "Has a consumer whose name lacks the r2000 prefix" is NOT the
//   discriminator, and reading it that way gets three entries wrong in one
//   direction and two in the other. Measured on this tree:
//
//     - THREE GLUE modules had prominent unprefixed consumers. The session
//       lifecycle is still imported by the stdio entry point directly
//       (`vice-proxy.ts:200`); the CLI is reached from `vice-proxy.ts:309`
//       plus four files under `scripts/`. `vice-proxy.ts` survives the
//       substrate swap. Its imports of those three modules do NOT -- and the
//       tool surface's import is ALREADY GONE, substituted for the owned
//       store's own surface by plan 29-01: there is no analyser tool
//       surface left to expose, and in due course no analyser session to
//       close and no analyser CLI to dispatch to. This record predicted that
//       and is being read back rather than rewritten.
//     - TWO CAPABILITY modules have no unprefixed consumer at all (the ACME
//       identifier module and the confidence-grade module). Their basis is
//       a requirement id, which is the second admissible basis and is not a
//       weaker one.
//
// WHAT NOT TO DO:
//   - Do not justify a verdict by the module's name. Every `basis` field is
//     scanned by the enforcing test's Direction 4 and a
//     name-as-justification is rejected there, so this is checkable rather
//     than promised. A `note` is deliberately EXEMPT from that scan,
//     because a note legitimately discusses the naming hazard this whole
//     record exists to remove.
//   - Do not leave an in-scope module, a deliberate scope exclusion, or a
//     contested verdict unrecorded. To a later reader acting under deletion
//     pressure, an unstated exclusion is indistinguishable from an
//     oversight.
//   - Do not add this module to `package.json`'s `files[]`. It is
//     bookkeeping, not shipped runtime behaviour, and its own test asserts
//     the absence mechanically.
//   - Do not turn the enforcing test's non-vacuity guard into a pinned
//     total. That guard derives its threshold from this array; see the
//     reasoning recorded beside the assertion itself.
//
// EXCLUDED, DELIBERATELY -- every scope decision, stated:
//   - THE NINETEEN `r2000-*.test.ts` FILES. A test file's fate follows its
//     module's, so a separate verdict for each would be a second copy of
//     the same judgement. They cannot go unaccounted for either way: a
//     committed drift guard already asserts that every `*.test.*` file on
//     disk lands in exactly one of the automated or manual-only sets.
//   - `docs-absorbed-decisions.test.ts`. A reader will expect it here. The
//     declared enumeration does not reach it, because its filename begins
//     `docs-` rather than `r2000-`. Named explicitly rather than left for a
//     reader to notice and wonder about.
//   - `scripts/lib/anno-cli-verbs.mjs` and its `.d.mts` declaration.
//     CUT-04 names the former explicitly as a guard whose fate must be
//     recorded, so both are carried here as DATA with
//     `scope: "out-of-enumeration"`, while the enforcing test's own
//     enumeration stays inside this module directory. They are excluded
//     from the disk-completeness loop by that marker, not by a special
//     case in the loop.
//
// THE THIRD VERDICT CURRENTLY HAS ZERO INSTANCES, AND THAT IS A FINDING.
// `glue-with-extractable` exists in the union because D-08 requires a
// verdict for "glue that is holding a capability hostage". Its one instance
// was the project builder, and all three of its extractable functions
// (`parsePrg`, `flatImageOrigin`, `decodeRawData`) moved out into
// `prg-image.ts` earlier in this phase, byte-identically and with no
// re-export shim -- so that entry is plain `glue` now, and the union's
// third value has no instance at the time this record is written. The
// verdict stays in the union: a later phase may find one, and removing the
// value would make that unsayable.
//
// THE GLUE-MODULE EXTRACTABLES SURVEY, AND WHAT IT FOUND. The other five
// glue modules were surveyed for a pure, name-independent symbol with a
// consumer that survives the substrate swap. RESULT: none found. Four
// candidates were considered and rejected on measurement, recorded so the
// survey reads as work done rather than an assumption:
//   - `parseR2000TimeoutMs` (`r2000-launch.ts:251`) is a pure
//     string-to-number parser with a range refusal, but its subject is the
//     analyser's own spawn timeout env var and it has no consumer outside
//     the family.
//   - `checkAcceptedOptions` (`anno-cli.ts:169`) is a generic argv option
//     checker, used only by the CLI it lives in and its own test.
//   - `resolveStorePath` (`r2000-tools.ts:972`) and
//     `composeAddressDetails` (`r2000-tools.ts:1121`) both exist to work
//     around specific behaviours of the analyser's own tool surface.
//   - the single-flight session queue (`r2000-session.ts:294` onward) has a
//     generic DISCIPLINE but an implementation bound to the analyser child
//     process, and no consumer outside the family.
//
// LINE CITATIONS ARE ADVISORY, AND THE LIABILITY IS MEASURED, NOT
// HYPOTHETICAL. Every `consumers[]` entry cites a path and the symbol
// imported; `line` is optional. Where present the enforcing test asserts
// the cited line CONTAINS the cited symbol rather than trusting the number,
// which is the shape `docs-linerefs.test.ts` already established. Three
// drifts were found while populating this file: the confidence-grade import
// into the census had moved by eleven lines, and both of the CLI's
// descriptions of the verify verdict had moved by eight -- all three
// because earlier work in this same phase inserted lines above them.
//
// ONE MEASURED CORRECTION WORTH CARRYING. EXPORT-02's clause about the 11
// typed label prefixes owned by `AUTO_NAME_PREFIX_RE` reads as though it
// belongs to the ACME identifier module. It does not: `AUTO_NAME_PREFIX_RE`
// is declared at `anno-coverage.ts:1392`, so EXPORT-02 anchors the CENSUS
// entry, and the ACME identifier module's basis is EXPORT-01 and EXPORT-03
// (identifier legality is a precondition of source that a real assembler
// accepts) instead.
//
// FOUR ENTRIES REST ON SEAM-02'S OWN ENUMERATION as their requirement
// anchor, which is the weakest basis shape in this record and is named as
// such: the disk-image reader, the memory-map renderer, the register-bit
// generator and the generated register-bit data file. Each has a real,
// stated rationale about what it does; what none of them has is an
// independent requirement id elsewhere in the family. A later reader
// weighing these four should read the rationale, not just the verdict.
//
// Deliberately a plain `.ts` module, never a `.test.ts` file: importing a
// `.test.ts` module for its exports would also re-run every top-level
// `test(...)` call it registers with the runner, as an import side effect,
// silently duplicating that file's execution inside whatever imports it.
// This module imports nothing at all.

/**
 * The three verdicts D-08 requires.
 *
 *   - "capability": the module implements something this project owns. It
 *     must survive the substrate swap under some name. Deleting it because
 *     of its name is the failure SEAM-02 exists to prevent.
 *   - "glue": the module's whole subject is the rented external analyser --
 *     spawning its binary, speaking its protocol, building its project
 *     file, owning its session, exposing its verbs. Nothing in it means
 *     anything once the analyser is gone.
 *   - "glue-with-extractable": glue that is holding a capability hostage.
 *     Its `extractables` names the specific symbols that must move out
 *     BEFORE it may be deleted. Currently zero instances -- see this file's
 *     header for why that is a finding rather than a vacuum.
 */
export type ModuleVerdict = "capability" | "glue" | "glue-with-extractable";

/**
 * Whether the enforcing test's disk enumeration is expected to find this
 * entry's module.
 *
 *   - "in-enumeration": the module lives in this directory and matches the
 *     declared scope, so BOTH completeness directions apply to it.
 *   - "out-of-enumeration": the entry is carried as data for a later
 *     reader's benefit, but the enforcing test's enumeration deliberately
 *     does not reach it. Excluded from the disk-completeness loop by this
 *     marker rather than by a special case inside the loop.
 *   - "discharged": the entry's module NO LONGER ANSWERS TO THE ENUMERATION
 *     because its fate has been carried out -- it was renamed out of the
 *     scanned family, or deleted. The entry is KEPT, as dated history: the
 *     verdict, the basis and the notes are the record of WHY the module was
 *     judged the way it was, and that record is exactly what a deletion
 *     under pressure destroys. Excluded from both completeness directions by
 *     this marker, like "out-of-enumeration", and carried instead by the
 *     DISCHARGE-CLOSURE relation, which checks the entry's `fate` against
 *     disk.
 */
export type ModuleScope = "in-enumeration" | "out-of-enumeration" | "discharged";

/**
 * WHAT HAPPENED TO A DISCHARGED MODULE -- the record that makes the third
 * scope value checkable rather than a shrug.
 *
 *   - "renamed": the module is still here, under `to`. `from` is the name it
 *     answered to when this record was written, kept because the whole point
 *     of this file is that a later reader can follow the judgement back to
 *     the tree it was made against.
 *   - "deleted": the module is gone. There is no `to`; `supersededBy` names
 *     what took over its subject, where anything did.
 *
 * `on` is the ISO date the fate was carried out and `why` states it in one
 * sentence. Both are prose for a human; the ENFORCED half is the closure
 * relation in the enforcing test -- a renamed fate whose `to` is not on disk,
 * or a deleted fate whose module still is, fails there. That is what stops a
 * rename from being RECORDED without HAPPENING.
 */
export type ModuleFate =
  | { readonly kind: "renamed"; readonly from: string; readonly to: string; readonly on: string; readonly why: string }
  | { readonly kind: "deleted"; readonly on: string; readonly why: string; readonly supersededBy?: string };

/**
 * One cited consumer of the classified module.
 *
 * `path` is ALWAYS repository-root-relative, never relative to this
 * directory, because consumers legitimately live under `scripts/` and
 * `src/skills/` as well as beside this file. The enforcing test asserts the
 * path exists on disk.
 *
 * `symbol` names what the consumer actually takes from the module (an
 * imported binding, or -- for a documentation consumer -- the identifier
 * the cited line names). It is a CITATION, never a justification.
 *
 * `line` is OPTIONAL AND ADVISORY. Where present, the enforcing test
 * asserts that line of that file contains `symbol`; it never trusts the
 * number. Omit it rather than guess.
 */
export interface ModuleConsumer {
  path: string;
  symbol: string;
  line?: number;
}

/**
 * Why the verdict is what it is. Must contain at least one consumer or at
 * least one requirement id, and a non-empty `rationale`.
 *
 * `requirements` holds requirement ids in the project's own
 * FAMILY-NN shape. `rationale` states, in terms of what the module DOES,
 * why the verdict follows.
 *
 * NOTHING IN THIS OBJECT MAY CITE THE MODULE'S NAME PREFIX AS THE REASON.
 * The enforcing test scans every field here and rejects it. Put a
 * discussion of the naming hazard in the entry's `note`, which is exempt.
 */
export interface ModuleBasis {
  consumers: readonly ModuleConsumer[];
  requirements: readonly string[];
  rationale: string;
}

/**
 * One classified module.
 *
 * `module` is the EXACT filename including its extension for an
 * in-enumeration entry (the completeness loop compares exact strings, and
 * one in-scope item is a `.json` data file, matched by its full filename and
 * never by a stem), and the repository-root-relative path for an
 * out-of-enumeration entry.
 *
 * `extractables` names the specific symbols that must move out before the
 * module may be deleted. Non-empty IF AND ONLY IF the verdict is
 * "glue-with-extractable" -- asserted in both directions by the enforcing
 * test.
 *
 * `note` carries anything a later reader must know that the basis cannot
 * say: a contested verdict and the text it contests, where a discharged
 * obligation went, or which weaker basis shape this entry rests on. It is
 * the ONE field exempt from the name-as-justification scan.
 */
export interface ModuleClassificationEntry {
  module: string;
  scope: ModuleScope;
  verdict: ModuleVerdict;
  basis: ModuleBasis;
  extractables: readonly string[];
  note?: string;
  /** REQUIRED IN PRACTICE for a "discharged" entry and meaningless without
   * one: what happened to the module, checked against disk by the enforcing
   * test's discharge-closure relation. Absent on every other scope. */
  fate?: ModuleFate;
}

export const MODULE_CLASSIFICATION: readonly ModuleClassificationEntry[] = [
  // --- capability: this project's own subject matter, under a rented name ---
  {
    module: "anno-acme-ident.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-acme-ident.ts",
      to: "anno-acme-ident.ts",
      on: "2026-08-29",
      why:
        "ACME identifier legality is this project's own subject matter (EXPORT-01/EXPORT-03); the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-tools.ts", symbol: "assertLegalAcmeIdentifier", line: 104 },
        { path: "src/mcp/vice/anno-enum-gen.ts", symbol: "MAX_ACME_IDENTIFIER_LENGTH", line: 86 },
        { path: "src/mcp/vice/anno-symbols.ts", symbol: "assertLegalAcmeIdentifier", line: 76 },
      ],
      requirements: ["EXPORT-01", "EXPORT-03"],
      rationale:
        "Owns ACME identifier legality: the identifier grammar, the 200-character ceiling, and the " +
        "reserved-mnemonic collision set. Source that a real assembler will accept cannot be emitted " +
        "without it, which is what EXPORT-01 demands and what EXPORT-03's refuse-rather-than-emit " +
        "discipline rests on. All three measured consumers are themselves inside the analyser family " +
        "and none of their imports survives, so this entry rests on its requirement ids -- the second " +
        "of the discriminator's two admissible bases, and not a weaker one.",
    },
    extractables: [],
    note:
      "EXPORT-02's clause about the 11 typed label name forms reads as though it belonged here. Measured, " +
      "it does not: the recogniser EXPORT-02 names is declared in the byte census, not here (that " +
      "entry's note gives the exact site), so EXPORT-02 anchors the census rather than this module.",
  },
  {
    module: "anno-confidence.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-confidence.ts",
      to: "anno-confidence.ts",
      on: "2026-08-29",
      why:
        "D-25's confidence-grade vocabulary is a second store surface this project owns (COV-01/COV-02); the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-coverage.ts", symbol: "CONFIDENCE_GRADES", line: 144 },
        { path: "src/mcp/vice/anno-memmap-render.test.ts", symbol: "formatConfidenceComment", line: 21 },
      ],
      requirements: ["COV-01", "COV-02"],
      rationale:
        "Owns D-25's confidence-grade vocabulary -- a machine-readable bracket token carried inside a " +
        "line comment -- which exists precisely because the annotation store's own block typing carries " +
        "classification but no confidence axis at all: it cannot distinguish an address observed " +
        "executing from one merely reachable. That distinction is this project's, not the analyser's, " +
        "and the byte census reads these grade tokens directly.",
    },
    extractables: [],
    note:
      "Measured while the store block boundary was extracted earlier in this phase: the census answers " +
      "from the grade token and returns BEFORE it consults the block class, so on a fully graded store " +
      "the block vocabulary is not on the answering path at all. The grades are therefore a second " +
      "store surface, and the block-vocabulary boundary did not move them. A later store substitution " +
      "that changes grade spellings is not covered by that boundary's substitutability proof.",
  },
  {
    module: "anno-coverage.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-coverage.ts",
      to: "anno-coverage.ts",
      on: "2026-08-29",
      why:
        "The byte-coverage census is the instrument CUT-01 states outright a family-sized deletion would take with it; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-cli.ts", symbol: "buildCoverageReport", line: 68 },
        { path: "src/mcp/vice/anno-coverage.test.ts", symbol: "buildCoverageReport" },
        { path: "src/mcp/vice/anno-coverage-grammar.test.ts", symbol: "coverageFindings" },
      ],
      requirements: ["COV-01", "COV-02", "EXPORT-02"],
      rationale:
        "The byte-coverage census: it classifies every one of the 65,536 addresses from observed bytes, " +
        "holds the bytes-versus-store independence axis, and computes the reproducibility comparison and " +
        "the divergence sub-report. It also owns the typed auto-name recogniser EXPORT-02 requires " +
        "carried rather than reimplemented as a shorter list, which would silently break the " +
        "routine-queue-walker skill's backlog construction. CUT-01 states outright that a deletion " +
        "sized by the whole family deletes this instrument.",
    },
    extractables: [],
    note:
      "Its entire contact with the annotation store is now one import of block-class.ts, and its payload " +
      "decoder is prg-image.ts's decodeRawData -- both landed earlier in this phase, so it no longer " +
      "reaches into the analyser family for either. The recogniser EXPORT-02 names is " +
      "declared at anno-coverage.ts:1392; it is named here rather than in the basis so the " +
      "basis stays free of the token the enforcing test's Direction 4 scans for.",
  },
  {
    module: "anno-d64.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-d64.ts",
      to: "anno-d64.ts",
      on: "2026-08-29",
      why:
        "1541 disk geometry is not a property of any tool; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-d64.test.ts", symbol: "sectorsPerTrack", line: 10 },
      ],
      requirements: ["SEAM-02"],
      rationale:
        "Pure Commodore 64 disk-format knowledge: per-track sector counts, track-and-sector to byte " +
        "offset arithmetic, the directory walk, and the refusal to treat a non-plain image as one. " +
        "Nothing in it consults the external analyser, and none of it changes when the substrate " +
        "changes -- the geometry of a 1541 disk is not a property of any tool.",
    },
    extractables: [],
    note:
      "One of the four entries whose only requirement anchor is SEAM-02's own enumeration, which is the " +
      "weakest basis shape in this record. Its skill-facing behaviour -- list the directory and refuse " +
      "rather than guess which file inside the image to analyse -- is documented at " +
      "src/skills/c64-program-recon/SKILL.md:274, and that guidance outlives the analyser.",
  },
  {
    module: "anno-enum-gen.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-enum-gen.ts",
      to: "anno-enum-gen.ts",
      on: "2026-08-29",
      why:
        "Re-runnable enum generation from observed register writes (R2000-13) reads a committed table, not the analyser; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-enum-gen.test.ts", symbol: "generateEnums" },
      ],
      requirements: ["R2000-13"],
      rationale:
        "Turns register writes observed in a capture into named enum variants -- one variant per " +
        "distinct value actually written -- and does so re-runnably, which is R2000-13's own stated " +
        "requirement: a regenerated set must be able to replace an old one. Its knowledge comes from " +
        "the committed register bit-name table it reads by path, not from the analyser.",
    },
    extractables: [],
  },
  {
    module: "anno-memmap-render.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-memmap-render.ts",
      to: "anno-memmap-render.ts",
      on: "2026-08-29",
      why:
        "The rendering discipline, the sidecar schema, the generated-file banner and the drift check are this project's; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-cli.ts", symbol: "renderMemoryMap", line: 63 },
        { path: "src/mcp/vice/anno-memmap-render.test.ts", symbol: "renderMemoryMap" },
      ],
      requirements: ["SEAM-02"],
      rationale:
        "Renders the human-readable Markdown memory map from an address-keyed annotation store plus a " +
        "validated, run-scoped provenance sidecar, and refuses a missing or malformed required sidecar " +
        "key by name -- listing every problem at once -- rather than substituting a placeholder. The " +
        "rendering discipline, the sidecar schema, the generated-file banner and the drift check are " +
        "this project's; the store queries it reads are the only part the substrate owns.",
    },
    extractables: [],
    note:
      "Second of the four SEAM-02-anchored entries. Skill-facing: it is documented as the generation " +
      "route (never hand-author an address row) at src/skills/c64-program-recon/SKILL.md:255.",
  },
  {
    module: "anno-regbits-gen.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-regbits-gen.ts",
      to: "anno-regbits-gen.ts",
      on: "2026-08-29",
      why:
        "The derivation's subject is Commodore 64 register layout; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-enum-gen.ts", symbol: "RegBitsTable", line: 85 },
        { path: "src/mcp/vice/anno-regbits.test.ts", symbol: "buildRegBits" },
      ],
      requirements: ["SEAM-02"],
      rationale:
        "Derives the VIC-II, SID and CIA register bit-name tables from the memory map's structured bit " +
        "entries and emits the committed, banner-marked, digest-pinned data file. Its subject is " +
        "Commodore 64 hardware register layout; the external analyser appears nowhere in the " +
        "derivation.",
    },
    extractables: [],
    note:
      "Third of the four SEAM-02-anchored entries. It PRODUCES anno-regbits.json, which carries its " +
      "own entry below because that file matches the declared enumeration scope.",
  },
  {
    module: "anno-regbits.json",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-regbits.json",
      to: "anno-regbits.json",
      on: "2026-08-29",
      why:
        "The one shipped data file in the declared scope, cited by filename from a shipped skill playbook; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/anno-enum-gen.ts", symbol: "REGBITS_PATH", line: 89 },
        { path: "src/mcp/vice/anno-regbits.test.ts", symbol: "anno-regbits.json", line: 48 },
        { path: "src/skills/c64-memory-mapping/SKILL.md", symbol: "anno-regbits.json", line: 195 },
      ],
      requirements: ["SEAM-02"],
      rationale:
        "The committed, generated register bit-name table -- shipped in the published tarball and " +
        "digest-pinned to the memory map it derives from. It holds Commodore 64 hardware facts, and a " +
        "shipped skill playbook cites it directly by filename as the source of the curated bit-name " +
        "table, so it has a documented consumer that does outlive the analyser.",
    },
    extractables: [],
    note:
      "Included in this record DELIBERATELY, not incidentally. It is the one data file in the declared " +
      "scope, and it is matched by its full filename including the extension rather than by a stem. An " +
      "enumeration that dropped it by accident would leave the family's only shipped data file with no " +
      "recorded fate. Fourth and last of the four SEAM-02-anchored entries.",
  },
  {
    module: "anno-symbols.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-symbols.ts",
      to: "anno-symbols.ts",
      on: "2026-08-29",
      why:
        "The validated label round trip (R2000-14/R2000-15) is what those requirements were validated against; the verdict is unchanged and only the name moved.",
    },
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-symbol-roundtrip.test.ts", symbol: "importLabels", line: 46 },
      ],
      requirements: ["R2000-14", "R2000-15"],
      rationale:
        "IMPLEMENTS the validated label round trip, rather than merely serving it: the VICE label-file " +
        "export of user-defined names only, and the re-import whose success is confirmed against disk " +
        "rather than against the tool's own report. R2000-14 and R2000-15 are both recorded validated, " +
        "and this module is what they were validated against.",
    },
    extractables: [],
  },
  {
    module: "r2000-test-gate.ts",
    scope: "in-enumeration",
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-verify.test.ts", symbol: "skipReasonFor", line: 40 },
        { path: "src/mcp/vice/r2000-tools.test.ts", symbol: "R2000_BIN", line: 38 },
      ],
      requirements: ["SEAM-01"],
      rationale:
        "Owns the availability-gate DISCIPLINE that SEAM-01 names: exactly one computed skip reason per " +
        "test file, never a hand-rolled early return, and a HARD FAILURE -- not a skip -- when the " +
        "environment declares the dependency mandatory. A gate that degrades into a silent skip looks " +
        "identical to a working one in a green log, which is the whole failure mode, and the discipline " +
        "that prevents it is reusable against any external dependency.",
    },
    extractables: [],
    note:
      "Its ACME half left for acme-gate.ts earlier in this phase with byte-identical symbol and " +
      "environment-variable names and NO re-export shim -- a case-insensitive search for 'acme' in this " +
      "module now returns nothing. Ten importers remain, all inside the analyser family. " +
      "CONTESTED, flagged rather than smoothed over -- the same shape the r2000-verify.ts entry below " +
      "flags for itself, and it was left unflagged here (WR-10). Two measurements sit in tension with " +
      "the 'capability' verdict: every one of the ten measured importers is an r2000-*.test.ts file, so " +
      "every consumer of this module dies with the substrate it gates; and the substrate-INDEPENDENT " +
      "half of its discipline has already been extracted, in this same phase, under a different name " +
      "(acme-gate.ts). What a later reader should carry forward is therefore the DISCIPLINE -- one " +
      "computed skip reason per file, never a hand-rolled early return, and a hard failure rather than " +
      "a skip when the environment declares the dependency mandatory -- which acme-gate.ts now also " +
      "embodies for a second dependency, proving it generalises. Do NOT read this verdict as a claim " +
      "that the module survives a prefix deletion: read it as a claim that the discipline must be " +
      "carried into whatever gates the successor's external dependencies. An unflagged tense verdict " +
      "here is how a later phase keeps dead code -- the inverse of the failure SEAM-02 targets, but " +
      "still one this record exists to prevent.",
  },
  {
    module: "r2000-verify.ts",
    scope: "in-enumeration",
    verdict: "capability",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-verify.test.ts", symbol: "acmeVerdict", line: 37 },
      ],
      requirements: ["EXPORT-01", "EXPORT-03"],
      rationale:
        "Owns the never-trust-the-exit-code verdict discipline. acmeVerdict() at r2000-verify.ts:116 " +
        "derives its result ONLY from parsed assembler result lines: it requires unanimity across every " +
        "such line, lets no passing line hide a later failing one, refuses to guess when two are " +
        "present, reads a skipped assembler as a failure rather than an absence of evidence, and never " +
        "consults the aggregate summary line that lied in the captured transcript this module was " +
        "written against. Both captured transcripts are pinned verbatim as fixtures. EXPORT-01 carries " +
        "that discipline forward explicitly and EXPORT-03 restates it.",
    },
    extractables: [],
    note:
      "CONTESTED, flagged rather than smoothed over. Success criterion 2 names this module among the " +
      "ten that are provably not deletable, and this record follows the phase's own binding text. But " +
      "EXPORT-01's preamble states verbatim that the existing verify seam invokes the external analyser " +
      "and parses ITS transcript, and that only the discipline survives. So what a later phase " +
      "inherits is the discipline and its two pinned false-pass transcripts, NOT the route. Act on the " +
      "discipline; do not read this verdict as a claim that the route survives. The CLI used to record " +
      "the same fact twice, in its header and again in cmdVerify(); plan 29-07 removed the verify " +
      "verb outright (D-14), so those two citations are gone rather than drifted, and this note is " +
      "now the only place the fact lives until Phase 30 rebuilds the route.",
  },

  // --- glue: the rented analyser is the whole subject ---
  {
    module: "anno-cli.ts",
    scope: "discharged",
    fate: {
      kind: "renamed",
      from: "r2000-cli.ts",
      to: "anno-cli.ts",
      on: "2026-08-29",
      why:
        "Renamed with the capability modules it dispatches to, so the surviving verbs keep a home while the "
        + "glue verbs are withdrawn (29-07) and their implementations deleted (29-10). The verdict is UNCHANGED: this is still glue, and the rename records where the glue went rather than reclassifying it.",
    },
    verdict: "glue",
    basis: {
      consumers: [
        { path: "src/mcp/vice/vice-proxy.ts", symbol: "runR2000Cli", line: 309 },
        { path: "scripts/check-skill-tool-coverage.mjs", symbol: "parseAnnoCliVerbs", line: 53 },
        { path: "src/mcp/vice/anno-cli.test.ts", symbol: "runR2000Cli" },
      ],
      requirements: [],
      rationale:
        "A verb dispatcher for the external analyser's command line: argv parsing, option acceptance " +
        "checks, temporary-project bootstrap, transcript printing and exit-code mapping. Every verb it " +
        "dispatches is a call into the analyser, and MCP-01 replaces the surface outright with one " +
        "derived from the procedure manifest. Its consumers outside the family are exactly the trap the " +
        "discriminator warns about: the stdio entry point and four files under scripts/ survive, while " +
        "their reason for reaching this module does not.",
    },
    note:
      "CONSUMER-CITATION UPDATE, 2026-08-29 (plan 29-07, D-14). This module dropped from SIX other " +
      "entries' consumer lists in one commit -- anno-d64.ts (listEntries), anno-enum-gen.ts " +
      "(generateEnums), anno-symbols.ts (exportLabels), r2000-verify.ts (verifyProject), " +
      "r2000-launch.ts (buildExportAsmArgs) and r2000-project.ts (synthesizeProject) -- because the " +
      "six verbs that reached them were removed. Those consumer rows were DELETED rather than " +
      "stripped of their line numbers: a citation whose line is dropped stops being checked by " +
      "Direction 9 while still asserting a consumer relationship that no longer exists, which is a " +
      "false record that reads as a maintained one. The two citations that survive (renderMemoryMap " +
      "and buildCoverageReport) were re-pointed to their new lines in the same commit. " +
      "Surveyed for extractables: checkAcceptedOptions is a generic argv option checker, but it has no " +
      "consumer outside this module and its own test, so it is not one.",
    extractables: [],
  },
  {
    module: "r2000-launch.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-verify.ts", symbol: "buildVerifyArgs", line: 46 },
        { path: "src/mcp/vice/anno-symbols.ts", symbol: "runR2000", line: 72 },
        { path: "src/mcp/vice/r2000-mcp-client.ts", symbol: "buildMcpServerStdioArgs", line: 84 },
      ],
      requirements: [],
      rationale:
        "Builds argv for, and spawns, the external analyser binary -- one argv-array builder per verb, " +
        "plus the timeout, buffer ceiling and the refusal of a flag belonging to that binary's own CLI. " +
        "Every export is a statement about a process that does not exist after the substrate swap.",
    },
    extractables: [],
    note:
      "Surveyed for extractables: parseR2000TimeoutMs is a pure parser with a range refusal, but its " +
      "subject is this binary's own timeout environment variable and it has no consumer outside the " +
      "family, so it is not one.",
  },
  {
    module: "r2000-mcp-client.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-tools.ts", symbol: "R2000Call", line: 108 },
        { path: "src/mcp/vice/r2000-session.ts", symbol: "openR2000Session", line: 554 },
        { path: "src/mcp/vice/anno-symbols.ts", symbol: "withR2000Session", line: 73 },
      ],
      requirements: [],
      rationale:
        "Speaks the wire protocol to the external analyser's own server over stdio: handshake, request " +
        "framing, call timeouts, restart budget, and the save-then-verify-persistence round trip. Its " +
        "entire vocabulary is that server's, so nothing in it means anything without it.",
    },
    extractables: [],
  },
  {
    module: "r2000-project.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "src/mcp/vice/r2000-session.ts", symbol: "ensureProjectSettings", line: 94 },
        { path: "src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs", symbol: "synthesizeProject", line: 63 },
      ],
      requirements: [],
      rationale:
        "Builds and settings-normalises the external analyser's own project file, whose format that " +
        "analyser owns. Once the store is this project's own, there is no such file to synthesise.",
    },
    extractables: [],
    note:
      "This is the module the third verdict was for, and the obligation is DISCHARGED, not overlooked. " +
      "Its three name-independent functions -- parsePrg, flatImageOrigin and decodeRawData -- moved out " +
      "into prg-image.ts earlier in this phase, byte-identically, with no re-export shim left behind, " +
      "and the byte census now reaches its payload decoder there. That is why the verdict here is plain " +
      "glue with an empty extractables list rather than glue-with-extractable.",
  },
  {
    module: "r2000-session.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "src/mcp/vice/vice-proxy.ts", symbol: "closeR2000SessionSync", line: 200 },
        { path: "src/mcp/vice/r2000-tools.ts", symbol: "runInR2000Session", line: 1164 },
      ],
      requirements: [],
      rationale:
        "Owns the analyser child process's session lifecycle: open, the strict-arrival single-flight " +
        "queue with its bounded wait, and the synchronous close on process exit. The stdio entry point " +
        "imports it directly and does survive -- but it imports it in order to close a session belonging " +
        "to a process that will not exist, so that import is not a surviving consumer.",
    },
    extractables: [],
    note:
      "Surveyed for extractables: the single-flight queue's discipline is generic, but its " +
      "implementation is bound to this child process and it has no consumer outside the family, so it " +
      "is not one.",
  },
  {
    module: "r2000-tools.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "scripts/check-skill-tool-coverage.mjs", symbol: "CURATED_R2000_TOOLS", line: 51 },
      ],
      requirements: [],
      rationale:
        "The curated tool surface over the external analyser's own verbs: the definitions, the curation " +
        "gate, the store-path resolver and the client-side compositions that work around specific " +
        "behaviours of that analyser. THREE of its consumers were outside the family -- the stdio entry " +
        "point, a structural guard and a CI script -- and that is precisely the trap the discriminator " +
        "warns about: all three survive, none of their imports does. TWO of those three imports are " +
        "already gone as of plan 29-01, which substituted the owned store's own anno_* surface into the " +
        "registration loop and re-pointed the structural guard onto it; the CI script's import is the " +
        "one still standing, and it is cited above so this verdict keeps a live basis rather than an " +
        "empty one. MCP-01 replaces this surface with one derived from the procedure manifest.",
    },
    extractables: [],
    note:
      "Surveyed for extractables: resolveStorePath and composeAddressDetails both exist to work around " +
      "behaviours of the analyser's own tool surface, so neither is one.",
  },

  // --- out-of-enumeration: carried as data, named by CUT-04, not enumerated ---
  {
    module: "scripts/lib/anno-cli-verbs.mjs",
    scope: "out-of-enumeration",
    verdict: "glue",
    basis: {
      consumers: [
        { path: "scripts/check-skill-tool-coverage.mjs", symbol: "parseAnnoCliVerbs", line: 53 },
        { path: "src/mcp/vice/anno-verb-coverage.test.ts", symbol: "parseAnnoCliVerbs", line: 24 },
      ],
      requirements: ["CUT-04"],
      rationale:
        "Parses the verb list out of the analyser CLI's own dispatch switch so that neither the CI " +
        "coverage script nor its committed non-vacuity proof hand-types one. Its subject is that CLI's " +
        "verb set, so it goes when the verbs go. CUT-04 names this file explicitly as a guard whose fate " +
        "must be recorded, which is why it is carried here.",
    },
    extractables: [],
    note:
      "Outside the enforcing test's enumeration by design: the enumeration stays inside this module " +
      "directory, so this entry is data for a later reader rather than something the completeness loop " +
      "checks. Stated here because an unstated exclusion is indistinguishable from an oversight. " +
      "Plan 29-05 renamed this file from scripts/lib/r2000-cli-verbs.mjs and re-pointed the path above; " +
      "the entry stays out-of-enumeration rather than becoming discharged, because it never answered to " +
      "the enumeration in the first place and moving it would empty the set DIRECTION 7 proves the " +
      "marker is doing the excluding with.",
  },
  {
    module: "scripts/lib/anno-cli-verbs.d.mts",
    scope: "out-of-enumeration",
    verdict: "glue",
    basis: {
      consumers: [{ path: "src/mcp/vice/anno-verb-coverage.test.ts", symbol: "parseAnnoCliVerbs", line: 24 }],
      requirements: ["CUT-04"],
      rationale:
        "The ambient type declaration that lets a strict TypeScript test import the verb parser beside " +
        "it. It has no subject of its own beyond that module's signatures and shares its fate exactly.",
    },
    extractables: [],
    note:
      "Same out-of-enumeration reasoning as the module it declares, and renamed alongside it by plan " +
      "29-05 (from scripts/lib/r2000-cli-verbs.d.mts). Recorded separately rather than folded into that " +
      "entry so a later reader deleting by path finds both files listed.",
  },
];

/**
 * The ONE accessor for a module's classification. Looks the entry up by
 * module key -- never by array position -- so every caller and the
 * enforcing test share one lookup rather than each re-deriving a find, and
 * so the record's order carries no meaning. Returns `undefined` for a
 * module with no entry; the enforcing test is what turns that into a
 * failure for anything in the declared scope.
 */
export function classificationFor(module: string): ModuleClassificationEntry | undefined {
  return MODULE_CLASSIFICATION.find((entry) => entry.module === module);
}
