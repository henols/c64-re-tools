---
phase: 09-the-assumption-probe-go-no-go
plan: 02
subsystem: infra
tags: [docker, cargo, rustc, glibc, container-cost, regenerator2000, probe]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "regenerator2000 0.9.20 installed and version-identified on the host (plan 09-01), the rustc >=1.88 first-pass toolchain-floor finding this plan corrected"
provides:
  - "Real, measured container-side toolchain build time and image-size cost for regenerator2000 0.9.20 (R2000-16(5)), single-stage vs multi-stage, as absolute numbers with no baseline to diff against"
  - "A corrected rustc floor (>=1.90, not >=1.88) discovered by an actual failed compile, not a documentation re-read"
  - "A new, previously-unknown finding: multi-stage builds crossing rust:*-slim -> node:*-slim need matching Debian releases (glibc generations), or the shipped binary fails at runtime with GLIBC_2.38/2.39 errors"
  - "Two committed, real Dockerfiles (single-stage, multi-stage) as evidence artifacts"
affects: [09-07]

tech-stack:
  added: ["rust:1.90-slim (Docker Hub, Debian 13 trixie)", "rust:1.90-slim-bookworm (Docker Hub, Debian 12 bookworm)", "node:22-slim (Docker Hub, Debian 12 bookworm)"]
  patterns: ["evidence transcript convention inherited from plan 09-01: literal $ command + real stdout/stderr, never reconstructed", "cold (--no-cache) docker build for install-cost measurement, cleaned up immediately after"]

key-files:
  created:
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/Dockerfile.single
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/Dockerfile.multi
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion1-container-toolchain-cost.txt
  modified: []

key-decisions:
  - "Corrected the rustc floor to >=1.90 after rust:1.88-slim (which plan 09-01's Cargo.lock-pin reading suggested would be sufficient) failed a real cargo install with quantette@0.6.0/safe_arch@1.2.0/wide@1.6.1 version errors"
  - "Changed the multi-stage builder base from rust:1.90-slim to rust:1.90-slim-bookworm after the first multi-stage build produced a binary that failed at runtime against node:22-slim with GLIBC_2.38/2.39 errors -- root cause confirmed directly via /etc/os-release in both base images (builder was Debian 13 trixie, runtime is Debian 12 bookworm)"
  - "Used docker images --filter reference=<name> per image instead of the plan's sketched two-positional-argument docker images form, since this host's docker (29.7.2) rejects more than one positional repository argument"

requirements-completed: [R2000-16]

duration: ~34min active work
completed: 2026-08-20
---

# Phase 09 Plan 02: Container Toolchain Cost Summary

**Cold container builds measure regenerator2000 0.9.20 at 1,256,576,420 bytes / 340s single-stage vs 250,820,636 bytes / 289s multi-stage (~5x size delta, no baseline to diff against), and along the way corrected the rustc floor to >=1.90 and found a Debian-release/glibc mismatch that breaks a naive multi-stage build.**

## Performance

- **Duration:** ~34 min active execution work
- **Started:** 2026-08-20T09:16:54+02:00 (base commit for this plan's session)
- **Completed:** 2026-08-20T09:50:22+02:00
- **Tasks:** 2/2
- **Files modified:** 3 (2 created fresh in Task 1, all 3 amended in Task 2; 0 product files touched)

## Accomplishments

- Resolved and verified real, working base image tags: `rust:1.90-slim` (rustc 1.90.0) for the single-stage build, `rust:1.90-slim-bookworm` (rustc 1.90.0, Debian 12) as the multi-stage builder, and `node:22-slim` (Node v22.23.2, Debian 12) as the multi-stage runtime -- all confirmed with real `docker manifest inspect` / `docker run --rm ... --version` calls, not assumed from tag names
- **Corrected plan 09-01's rustc-floor finding**: `rust:1.88-slim` resolves and satisfies the four Cargo.lock pins plan 09-01 checked, but a real `cargo install regenerator2000` against it fails outright -- `quantette@0.6.0 requires rustc 1.90`, `safe_arch@1.2.0` and `wide@1.6.1` require `rustc 1.89`. The real floor is **rustc >= 1.90**.
- **Found a new, previously undocumented failure mode**: a multi-stage build with `rust:1.90-slim` (Debian 13 "trixie") as builder and `node:22-slim` (Debian 12 "bookworm") as runtime produces a binary that fails immediately with `GLIBC_2.38'/'GLIBC_2.39' not found`. Root cause confirmed directly (`/etc/os-release` in both images) as a builder/runtime Debian-release mismatch, not anything Rust- or crate-specific. Fixed by pinning the builder to `rust:1.90-slim-bookworm`.
- Measured both variants as real cold (`--no-cache`) builds: single-stage 1,256,576,420 bytes (~1.26GB) in 5m39.970s; multi-stage 250,820,636 bytes (~251MB) in 4m48.989s -- a ~5x size difference between "ship the whole toolchain forever" and "ship only the compiled binary"
- Confirmed `R2000_VERSION_IN_IMAGE` (`regenerator2000 0.9.20`) matches plan 09-01's host `INSTALLED_VERSION` exactly -- no version-reproducibility mismatch, once the glibc-mismatch fix was applied (the pre-fix binary could not even report its version)
- Cleaned up both probe images and the builder cache immediately after measurement; both Dockerfiles remain committed as evidence

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve real base-image tags and write both throwaway Dockerfiles** - `e24f7ea` (feat)
2. **Task 2: Build both variants, measure time and size, then delete the images** - `b353a49` (feat)

_No plan-metadata commit -- worktree mode; STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge, per this plan's explicit instruction._

## Files Created/Modified

- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/Dockerfile.single` - single-stage probe Dockerfile, `FROM rust:1.90-slim`, `RUN cargo install regenerator2000`
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/Dockerfile.multi` - multi-stage probe Dockerfile, `rust:1.90-slim-bookworm` builder + `node:22-slim` runtime, `COPY --from=builder` of only the compiled binary
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion1-container-toolchain-cost.txt` - base-tag resolution transcripts, both Dockerfiles verbatim, both cold-build transcripts with real timing lines, the rustc-floor and glibc-mismatch findings, the `## Result` block, the `## Baseline note`, and cleanup commands

No files under `.claude/mcp/vice/` were touched (`git diff --stat` confirmed empty relative to the two task commits). `09-RESEARCH.md` was **not** modified, per this plan's instruction that plan 09-07 owns applying corrections in one pass -- both corrections below are recorded in `criterion1-container-toolchain-cost.txt`'s `## RESEARCH CORRECTIONS` section instead.

## Decisions Made

- **rustc floor corrected from >=1.88 to >=1.90**, discovered by an actual failed `docker build` against `rust:1.88-slim`, not by re-reading `Cargo.lock`. Recorded as `## RESEARCH CORRECTIONS` item 1.
- **Multi-stage builder base changed from `rust:1.90-slim` to `rust:1.90-slim-bookworm`** after the first multi-stage build's binary failed at runtime with GLIBC errors against `node:22-slim`. This is a Rule 1 (bug) auto-fix: the multi-stage Dockerfile's own deliverable is a *working* binary, and shipping one that crashes on `--version` would not have satisfied the plan's own acceptance criteria. Recorded as `## RESEARCH CORRECTIONS` item 2, and flagged as a new finding `09-RESEARCH.md` did not anticipate.
- **`docker images` two-positional-argument form replaced with `--filter reference=`** per image, since this host's docker (29.7.2) rejects more than one positional repository argument. Minor CLI-surface note, not a probe result; recorded as `## RESEARCH CORRECTIONS` item 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] rust:1.88-slim fails a real cargo install; corrected base tag to rust:1.90-slim**
- **Found during:** Task 2, first single-stage build attempt
- **Issue:** Plan 09-01's evidence established rustc >= 1.88 as the toolchain floor (from Cargo.lock pin versions), and this plan's Task 1 resolved and used `rust:1.88-slim` accordingly. The actual cold build failed: `rustc 1.88.0 is not supported by the following packages: quantette@0.6.0 requires rustc 1.90, safe_arch@1.2.0 requires rustc 1.89, wide@1.6.1 requires rustc 1.89`.
- **Fix:** Re-resolved and confirmed `rust:1.90-slim` (rustc 1.90.0), updated both Dockerfiles' `FROM`/builder lines, and re-ran the (successful) single-stage build that produced this plan's `SINGLE_STAGE_BYTES`/`SINGLE_STAGE_BUILD_SECONDS` numbers.
- **Files modified:** `evidence/Dockerfile.single`, `evidence/Dockerfile.multi`, `evidence/criterion1-container-toolchain-cost.txt`
- **Verification:** Cold build against `rust:1.90-slim` completed successfully (`Finished release profile ... in 5m 33s`, exit 0, image written).
- **Committed in:** `b353a49` (Task 2 commit)

**2. [Rule 1 - Bug] Multi-stage builder/runtime Debian mismatch produces a broken binary; pinned builder to rust:1.90-slim-bookworm**
- **Found during:** Task 2, runtime verification of the first multi-stage build
- **Issue:** `docker run --rm r2000-probe-multi --version` failed with `GLIBC_2.38'/'GLIBC_2.39' not found` -- the binary compiled in `rust:1.90-slim` (Debian 13 "trixie") could not run against `node:22-slim`'s (Debian 12 "bookworm") older glibc. Confirmed root cause directly via `/etc/os-release` in both images, not inferred.
- **Fix:** Changed the multi-stage builder base to `rust:1.90-slim-bookworm` (same rustc 1.90.0, but Debian 12, matching the runtime stage's glibc generation), rebuilt, and re-verified `--version` succeeds (`regenerator2000 0.9.20`).
- **Files modified:** `evidence/Dockerfile.multi`, `evidence/criterion1-container-toolchain-cost.txt`
- **Verification:** `docker run --rm r2000-probe-multi --version` returned `regenerator2000 0.9.20` cleanly after the fix; the `MULTI_STAGE_BYTES`/`MULTI_STAGE_BUILD_SECONDS` numbers in the `## Result` block are from this corrected, working build.
- **Committed in:** `b353a49` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1)
**Impact on plan:** Both fixes were necessary to produce a real, working measurement rather than a `could-not-run` for one variant or a broken-but-measured binary. Both are recorded as new findings for Phase 10's `R2000-03`, since neither was anticipated by `09-RESEARCH.md` or plan 09-01.

## Issues Encountered

- **`rust:1.88-slim` is resolvable and version-correct by tag name, but insufficient in practice** -- a genuine gap between "the manifest exists and rustc reports 1.88.0" and "this crate's real transitive dependency graph compiles against it". Only a real cold build surfaced the true floor (>=1.90). Phase 10's `R2000-03` should state the floor as rustc >= 1.90 with this evidence file as the source, not re-derive it from `Cargo.lock` pins alone.
- **Cross-stage Debian-release mismatch is a real, silent multi-stage-build trap**: nothing in `09-RESEARCH.md`'s Code Examples flagged that `rust:1.85-slim`/`rust:1.90-slim` (trixie) and `node:24-slim`/`node:22-slim` (bookworm) are on different Debian releases with incompatible glibc. A naive multi-stage Dockerfile following the research's sketch exactly would ship a binary that crashes on first invocation. Any real devcontainer Dockerfile for regenerator2000 needs either matching Debian releases across stages or a statically-linked (e.g. musl) build.
- **This docker version's CLI surface drifted from the plan's own sketch**: `docker images <repo1> <repo2>` (two positional args) is rejected outright by docker 29.7.2. Worked around with `--filter reference=` per image; no functional impact on the measurement itself.

## User Setup Required

None -- both probe images were built, measured, and removed entirely within this session using already-available `docker`. No external service configuration required.

## Next Phase Readiness

**Ready for plan 09-07 (research corrections pass):**

- Three corrections are recorded in `evidence/criterion1-container-toolchain-cost.txt`'s `## RESEARCH CORRECTIONS` section for plan 09-07 to apply to `09-RESEARCH.md` in one pass: (1) rustc floor is >=1.90, not >=1.88; (2) multi-stage builds crossing `rust:*-slim` and `node:*-slim` need matching Debian releases or a static-link workaround; (3) this docker version's `docker images` CLI surface rejects two positional repository arguments.
- The six machine-readable `## Result` lines are quoted below for plan 09-07 (and any later plan) to read directly rather than re-deriving:

```
SINGLE_STAGE_BYTES: 1256576420
SINGLE_STAGE_BUILD_SECONDS: 340
MULTI_STAGE_BYTES: 250820636
MULTI_STAGE_BUILD_SECONDS: 289
BASE_RUST_TAG: rust:1.90-slim (single-stage build); rust:1.90-slim-bookworm (multi-stage builder stage)
BASE_RUNTIME_TAG: node:22-slim
R2000_VERSION_IN_IMAGE: regenerator2000 0.9.20 (matches plan 09-01's host INSTALLED_VERSION exactly)
```

- No blockers for the rest of wave 2 or any later wave. Both probe images are removed from the host and the builder cache was pruned; the only lasting artifacts are the two committed Dockerfiles and this evidence transcript.

---
*Phase: 09-the-assumption-probe-go-no-go*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 4 files verified present on disk (`Dockerfile.single`, `Dockerfile.multi`,
`criterion1-container-toolchain-cost.txt`, `09-02-SUMMARY.md`); all 3 task/plan
commits (`e24f7ea`, `b353a49`, `3c06741`) verified present in `git log`.
