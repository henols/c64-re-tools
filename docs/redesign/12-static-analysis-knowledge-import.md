# 12 — Static analysis and knowledge import

## 1. Purpose

Define how DXA/Ghidra findings become durable project knowledge and how later analysis removes stale analyzer-derived facts without erasing history or overwriting semantic knowledge.

The key rule is:

> An analyzer import is a snapshot of the facts that analyzer currently asserts for a declared address coverage. Re-analysis reconciles that analyzer's own current facts inside that coverage.

This avoids append-only stale analysis while keeping the database model small.

## 2. Boundaries

~~~text
DXA / Ghidra
     ↓
Host Runtime
     ↓
static-analysis skill script
     ↓
normalized findings
     ↓
local deterministic importer
     ↓
knowledge.db
~~~

DXA, Ghidra and the Host Runtime never open knowledge.db.

The LLM does not manually loop over hundreds of analyzer findings.

## 3. Parse before write

The analyzer adapter must completely receive, parse and validate a result before any knowledge mutation begins.

If the result is malformed, truncated, internally inconsistent or the analyzer operation failed:

~~~text
import nothing
leave current knowledge unchanged
return actionable failure
~~~

This carries forward an important lesson from the current implementation: one analyzer import is atomic.

## 4. Normalized findings

The internal normalized result contains only durable structural concepts needed by the importer.

Conceptually:

~~~text
analyzer
coverage
symbols
regions
references
authoritative categories
~~~

Typical items:

### Symbols

~~~text
address
name
kind
~~~

Only useful generated/static names need to be included. Names that merely echo semantic labels used to seed the analyzer need not create analyzer-owned symbol rows.

### Regions

~~~text
start_address
end_address
type
~~~

### References

~~~text
from_address
to_address
kind
~~~

Reference ownership/re-analysis coverage is determined by from_address, because that is the instruction/source location the analyzer inspected.

### Coverage

Coverage is one or more address ranges for which the analyzer result can make replacement claims.

A targeted analysis can therefore reconcile only a small range without disturbing findings elsewhere.

### Authoritative categories

An analyzer adapter states internally which categories are complete enough for absence to mean "the analyzer no longer asserts this fact."

For example:

~~~text
symbols: authoritative
regions: authoritative
references: not authoritative
~~~

if a particular adapter/run cannot guarantee a complete reference snapshot.

These completeness mechanics are internal and are not exposed to the LLM.

## 5. Why authoritative coverage is required

Without an authoritative boundary, a missing finding is ambiguous:

~~~text
not found because it disappeared
or
not found because this run never looked there
~~~

Only an authoritative category inside declared coverage may retire an older analyzer-owned fact.

This prevents partial/targeted runs from deleting unrelated knowledge.

## 6. Import transaction

A successful analyzer import is one knowledge revision and one SQLite transaction.

Conceptual flow:

~~~text
BEGIN
  validate expected knowledge revision if supplied
  create analyzer-import revision
  for each authoritative category:
      load current rows owned by this analyzer in coverage
      compare snapshot with current rows
      close stale/replaced analyzer rows
      insert new compatible rows
  process non-authoritative categories as add/update-only
  collect conflicts
  update current revision
COMMIT
~~~

If any database operation fails, the whole import rolls back.

## 7. Same-analyzer re-analysis

A later run of the same analyzer is allowed to replace that analyzer's own current structural facts inside authoritative coverage.

Example:

~~~text
rev 10 / ghidra
$2100 = routine
$2200 = routine

later Ghidra authoritative run over $2000-$22ff:
$2100 = routine
(no function at $2200)

new revision:
$2100 unchanged
$2200 old Ghidra symbol closed
~~~

The old $2200 row remains visible in history.

No special analysis-run table is required.

## 8. Stale reference retirement

References are especially prone to becoming stale.

Suppose Ghidra currently owns:

~~~text
$2110 -> $3000 READ
$2120 -> $4000 CALL
~~~

A later authoritative Ghidra reference snapshot over source addresses $2100-$21ff contains only:

~~~text
$2110 -> $3000 READ
~~~

Then the importer:

- leaves the first reference current;
- closes the old $2120 -> $4000 CALL row;
- records that closure in the new revision.

References whose from_address lies outside coverage are untouched.

## 9. Region reconciliation

Regions require coverage-aware splitting.

Example current analyzer row:

~~~text
$2000-$2fff code [dxa]
~~~

Targeted authoritative DXA re-analysis covers only:

~~~text
$2400-$24ff
~~~

The importer must not discard the untouched parts.

If the new snapshot changes $2400-$24ff, reconciliation conceptually produces:

~~~text
$2000-$23ff code [dxa]
new classification for $2400-$24ff
$2500-$2fff code [dxa]
~~~

in one revision, while the original $2000-$2fff row becomes historical.

This uses the same transactional split behavior already required for semantic region edits.

## 10. Semantic knowledge is protected

Analyzer-owned rows and semantic rows follow different replacement rules.

Semantic origins:

~~~text
user
llm
~~~

Analyzer origins:

~~~text
dxa
ghidra
~~~

An analyzer import may automatically replace/retire its own analyzer-derived rows within authoritative coverage.

It may not silently replace a contradictory current semantic row.

Example:

~~~text
current:
$2100 update_player routine [llm]

new Ghidra:
$2100 FUN_2100 routine
~~~

Result:

~~~text
keep update_player
do not create a generated-name conflict
~~~

The address correlation is enough; preserving FUN_2100 as a current alias is unnecessary. Older generated names remain available in history if they previously existed.

## 11. Cross-analyzer disagreement

DXA does not silently replace contradictory current Ghidra knowledge, and Ghidra does not silently replace contradictory current DXA knowledge.

Example:

~~~text
current:
$3000-$30ff code [dxa]

new Ghidra:
$3000-$30ff data
~~~

The importer reports a structural conflict.

The skill/LLM can then use runtime evidence, memory-map knowledge or further analysis to resolve it semantically.

This avoids hiding analyzer disagreement behind a hard-coded "Ghidra always wins" precedence rule.

## 12. Compatible additions and refinements

Not every difference is a conflict.

Examples:

- no current symbol + Ghidra function → insert;
- semantic update_player + Ghidra generated FUN_2100 → keep semantic name, no conflict;
- analyzer routine kind agrees with semantic routine kind → unchanged/compatible;
- analyzer reference into a semantically named target → insert the reference without changing the target symbol.

The importer should avoid manufacturing conflicts that do not change current meaning.

## 13. Non-authoritative findings

A non-authoritative category may add useful new facts but cannot retire old ones by absence.

This is used when an adapter can extract some facts reliably but cannot guarantee its output is complete.

~~~text
new fact present
    → add if compatible

old fact missing
    → leave current
~~~

This is safer than pretending every analyzer output is a complete snapshot.

## 14. Result returned to the skill

The normal LLM-facing result should be compact and actionable.

Conceptually:

~~~text
added
changed/retired
unchanged
conflicts
important requested findings
~~~

Do not normally expose:

- internal run identifiers;
- tool/package/protocol versions;
- hashes used only for integrity;
- raw analyzer transfer format;
- SQL/revision mechanics.

Knowledge history can still expose the meaningful fact that a change came from DXA or Ghidra and what project knowledge changed.

## 15. Revision history

Analyzer reconciliation never deletes history.

Example:

~~~text
rev 12 / dxa
$3000-$30ff code

rev 21 / ghidra
conflict reported; no semantic overwrite

rev 25 / llm
$3000-$30ff sprite

rev 40 / dxa re-analysis
new DXA findings reconciled, semantic sprite remains protected
~~~

Historical analyzer mistakes therefore remain reviewable.

## 16. Internal diagnostics

Analyzer input hashes and native-tool version information may be stored internally when useful for human diagnosis/reproducibility.

They are not normal LLM-facing fields.

This follows the project-wide actionability boundary.

## 17. Analyzer-specific expectations

### DXA

Primarily contributes:

- fast code/data structural classification;
- routine/label candidates where sufficiently deterministic;
- listing output for immediate analysis.

DXA is normally the first structural pass.

### Ghidra

Primarily contributes:

- function starts;
- deeper code/data structure;
- calls/jumps/read/write/reference relationships;
- deeper artifacts such as decompilation for immediate reasoning.

Only durable normalized structure is automatically persisted. Decompiler text remains transient.

## 18. Knowledge seeding of Ghidra

Before running Ghidra, the static-analysis script reads current project knowledge.

Useful seeds include:

~~~text
current routine symbols → entry points
current non-code regions → data classifications
current semantic names → labels where supported
~~~

Historical rows are not used as current seeds.

A seed echoed back by Ghidra does not transfer ownership of semantic knowledge to Ghidra.

## 19. Failure rule

If the importer cannot determine safely whether a structural change is compatible, treat it as a conflict rather than silently choosing a winner.

The LLM should receive the C64-level disagreement it can investigate, not the importer mechanics that detected it.
