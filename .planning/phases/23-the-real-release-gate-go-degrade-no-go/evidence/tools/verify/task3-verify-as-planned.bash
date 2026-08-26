#!/usr/bin/env bash
# 23-02-PLAN.md task 3 <verify><automated>, verbatim except for the .sh -> .bash
# filename this repo's tracked-shell-script gate requires (see README.md here).
D=.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence
grep -q "## REFERENCES" "$D/ExportAnalysis23.java" &&
grep -q "## CLASSIFICATION" "$D/ExportAnalysis23.java" &&
grep -q "REFERENCE_COUNT" "$D/ExportAnalysis23.java" &&
grep -q "CLASSIFICATION_LINES" "$D/ExportAnalysis23.java" &&
! grep -qE "n *< *400" "$D/ExportAnalysis23.java" &&
grep -q "COMPUTED_JUMP" "$D/tools/instrument-provenance.txt" &&
echo EXPORT-OK
