---
title: acme-build's template.a scaffold does not assemble on either provisioning route (bare-binary or apt) — CI has the identical gap silently
date: 2026-08-19
priority: high
source: 08.1-WALKTHROUGH-SETUP.md FINDING-A1 (corrected and widened) — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
---

# `acme-build`'s scaffold `template.a` requires a `cbm/c64/*.a` library absent from both provisioning routes

`acme-build/SKILL.md`'s documented scaffold, `template.a`, `!source`s a `cbm/c64/vic.a`,
`cbm/c64/kernal.a` and `cbm/c64/cia1.a` standard library. Neither of the two routes the
skill documents for provisioning ACME supplies that library:

- A bare ACME binary already on `$PATH` (this session's `~/.local/bin/acme`, ACME 0.97
  "Zem") has no accompanying `cbm/c64/*.a` files.
- The Debian trixie `apt` candidate package (`acme` `1:0.97~svn20211115+ds-2`) was
  downloaded and inspected read-only (`apt-get download` + `dpkg-deb -x`, no install
  performed) — its file list has no `cbm/c64/*.a` library either, only
  `usr/share/doc/acme/examples/*` sample sources that `template.a` does not use.

**CI has the identical gap, silently.** `.github/workflows/ci.yml:58` runs
`sudo apt-get install -y acme` and only checks the binary exists and prints a version
banner (lines 59-61) — it never assembles `template.a` or anything that `!source`s the
library. `disasm-roundtrip.test.ts` (the test that does exercise ACME in CI) does not
use the scaffold either. CI stays green for the same reason a bare `acme --version`
succeeds locally while `template.a` fails to build: presence of the binary was verified,
presence of the library never was.

Bare ACME itself is not broken — a library-free `.a` assembles fine with the same
binary. The defect is scoped precisely to "any source that `!source`s the `cbm/c64/*`
library, provisioned either documented way."

## Why deferred rather than fixed here

Out of scope for Phase 8.2 (`.planning/ROADMAP.md`'s "Not in scope" fence for this
phase) — this phase closes v0.2.0's Drive8Type/test-gate/walkthrough blockers, not
`acme-build`'s own scaffold. The human explicitly rejected installing a third-party
ACME standard library as needlessly invasive for the Phase 8.1 walkthrough's purpose
(see 08.1-WALKTHROUGH-SETUP.md's "Human decision (authoritative)"); that decision
did not close this finding, it only routed around it for that one walkthrough by
building a library-free capture target instead of `template.a`.

## What would close it

Either vendor a minimal `cbm/c64/*.a` library alongside `acme-build`'s scaffold (so
`template.a` is genuinely self-contained), or rewrite `template.a` to use only local
hardware constants (as this walkthrough's substitute source did) and update
`acme-build/SKILL.md`'s "Verified live" claim and CI's `ci.yml:58-61` check to actually
assemble the scaffold, not merely probe the binary.

---

## Resolved 2026-08-20 (Phase 10, plan 10-07)

Closed by rewriting `template.a` to use five locally-defined hardware constants
(`vic_cborder`, `vic_cbg`, `viccolor_BLACK`, `viccolor_GREEN`, `k_chrout`) instead of
`!source`ing the absent `cbm/c64/*.a` library, updating `acme-build/SKILL.md`'s Setup
section to state the measured, re-checkable truth (citing the new CI step by name
instead of a one-machine dated claim), and adding a CI step —
"Assemble the acme-build scaffold (library-free)" — that actually assembles the
scaffold and checks its `$0801` load address, replacing a banner-grep-only proof.
Live-verified on this host: a warning-free 55-byte `.prg`, `$0801`-`$0836`.
