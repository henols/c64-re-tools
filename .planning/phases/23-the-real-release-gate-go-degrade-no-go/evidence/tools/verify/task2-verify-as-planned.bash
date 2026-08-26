#!/usr/bin/env bash
# 23-02-PLAN.md task 2 <verify><automated>, verbatim.
D=.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence
grep -q "Memory" "$D/FlatVolatile.java" &&
grep -c "split" "$D/FlatVolatile.java" | grep -qE "^[1-9]" &&
grep -q "createUninitializedBlock" "$D/FlatVolatile.java" &&
grep -qE "vol=true" "$D/tools/instrument-provenance.txt" &&
grep -cE "vol=true" "$D/tools/instrument-provenance.txt" | grep -qE "^[2-9]" &&
echo VOLATILE-OK
