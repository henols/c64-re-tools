# API Coverage — Phase 13: External Verification

No external API integration: this phase adds no capability and integrates no
external API, SDK or service — it re-verifies three already-shipped internal
surfaces (binmon wire fixtures, the `--help` backend discriminator, four Phase 3
wire assumptions) against locally installed VICE binaries and corrects the
project's own records. The deterministic detector confirms this
(`{"detected": false, "signals": []}` over the phase scope at plan time).

The one protocol surface exercised here — stock VICE's binary monitor — is a
pre-existing, already-integrated dependency whose capability surface was decided
in the v0.2.0 milestone (38 stock tools, per `docs/stock-vice-parity.md`); this
phase advertises no new opcode, tool or flag, so there is nothing new to decide
coverage for.
