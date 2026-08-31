# Phase 32 — API Coverage Declaration

No external API integration: this phase ships no product code at all — it deletes a
static-analysis integration, adds three local Node guard/instrument scripts under
`scripts/`, wires one of them into `.github/workflows/ci.yml`, and writes planning
evidence; nothing here adds or changes a client, SDK, HTTP transport, credentialed
endpoint, MCP tool or manifest entry.

## Why this declaration is written out rather than left implicit

The deterministic api-coverage detector returned `detected: false` over this phase's
ROADMAP section at plan time. The declaration exists anyway, deliberately, because a
seal-time re-detection would be running over a *different* corpus: this phase's own
vocabulary is saturated with the word **integration**, and every one of those uses
refers to the DELETED SUBJECT — the third-party static-analysis integration whose
removal is the phase's entire point — not to an integration this phase performs.
The same is true of "endpoint", "surface" and "coverage" as they appear in the guard
prose. A re-detection firing on that vocabulary would be a false positive on the
past tense.

Confirmed against scope rather than preference:

- The phase's only new executables are `scripts/check-guard-fates.mjs` and the
  committed audit mutation harness. Both read the local git object store via
  `execFileSync("git", [...])` with an argv array, read committed files, and print.
  Neither opens a socket, reads a credential, or imports an HTTP client.
- The one CI change is a `run:` line invoking a local script plus `fetch-depth: 0`
  on an existing `actions/checkout@v4` — a clone-depth setting on an action this
  workflow already used, not a new service dependency.
- The close-gate run in plan 32-09 executes this repository's own existing test and
  check scripts. `/usr/bin/x64sc` is a locally-installed emulator binary, not a
  remote API, and the `vice` MCP tool surface is untouched by this phase: no tool
  added, no manifest changed.
- No package is installed by any plan in this phase (`T-32-SC`, disposition
  `accept`, in every plan's `<threat_model>`).

A capability matrix here would have to invent a capability that does not exist, so
this reasoned declaration stands in its place.

*Declared: 2026-08-31, at execution time (plan 32-09, Task 1).*
