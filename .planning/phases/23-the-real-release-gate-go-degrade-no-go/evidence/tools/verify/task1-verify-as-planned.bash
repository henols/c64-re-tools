#!/usr/bin/env bash
# 23-02-PLAN.md task 1 <verify><automated>, verbatim.
D=.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence
grep -v "^#" "$D/tools/instrument-provenance.txt" | grep -qE "^DXA_TARBALL_SHA256_VERIFIED: pass$" &&
grep -v "^#" "$D/tools/instrument-provenance.txt" | grep -qE "^DXA_TARBALL_SHA256: 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799$" &&
grep -v "^#" "$D/tools/instrument-provenance.txt" | grep -qE "^DXA_BINARY_SHA256: [0-9a-f]{64}$" &&
grep -v "^#" "$D/tools/instrument-provenance.txt" | grep -qE "^GHIDRA_VERSION: 12\.1\.3" &&
grep -v "^#" "$D/fixture/fixture-baseline.txt" | grep -qE "^FIXTURE_REPRODUCED: (pass|fail)$" &&
grep -v "^#" "$D/fixture/fixture-baseline.txt" | grep -qE "^FIXTURE_DATA_RECOVERY_PCT: [0-9]+\.[0-9]{2}$" &&
test -x "$D/tools/dxa" &&
node --check "$D/dxa-listing-parse.mjs" &&
echo TRACER-OK
