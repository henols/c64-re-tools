#!/usr/bin/env bash
# Throwaway Wave 0 verification harness for Phase 8.1's seven audit §7 drift items
# (D-1..D-7). NOT wired into CI, not a permanent guardrail — see
# 08.1-RESEARCH.md § Don't Hand-Roll. Every assertion below is scoped to an
# explicitly named file; never search recursively over .planning/, since this script's own
# text would self-satisfy every assertion it defines.
#
# Each D-item prints exactly one PASS/FAIL line (some items combine several
# sub-conditions with AND; if any sub-condition is unmet the item is FAIL and
# the unmet sub-condition(s) are named in the message). D-4 and D-5 (ROADMAP.md,
# STATE.md) and part of D-6/D-7 belong to plan 08.1-02, not this plan — they are
# expected to stay FAIL until that plan lands.
set -uo pipefail

REQ=".planning/REQUIREMENTS.md"
ROAD=".planning/ROADMAP.md"
STATE=".planning/STATE.md"

FAIL_COUNT=0

report() {
  # report <id> <ok:0|1> <detail-if-fail>
  local id="$1" ok="$2" detail="$3"
  if [ "$ok" -eq 1 ]; then
    echo "PASS ${id}: all sub-conditions met"
  else
    echo "FAIL ${id}: ${detail}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

eq() { [ "$1" -eq "$2" ]; }
ge() { [ "$1" -ge "$2" ]; }

# ---- D-1: 17 cut requirements no longer read Pending ----
d1_pending=$(grep -cF '| Pending |' "$REQ")
d1_ok=1; d1_detail=""
eq "$d1_pending" 0 || { d1_ok=0; d1_detail="'| Pending |' count in REQUIREMENTS.md is ${d1_pending}, expected 0"; }
report "D-1" "$d1_ok" "$d1_detail"

# ---- D-2: DIRECT-06 traceability row reconciled ----
d2_old=$(grep -cF 'DIRECT-06 | Phase 3 (attach) / Phase 7 (detach)' "$REQ")
d2_new=$(grep -cF '| DIRECT-06 | Phase 3 | Complete (attach); detach CUT 2026-08-17' "$REQ")
d2_ok=1; d2_detail=""
eq "$d2_old" 0 || { d2_ok=0; d2_detail+="stale DIRECT-06 row still present (count ${d2_old}, expected 0); "; }
eq "$d2_new" 1 || { d2_ok=0; d2_detail+="reconciled DIRECT-06 row count is ${d2_new}, expected 1; "; }
report "D-2" "$d2_ok" "$d2_detail"

# ---- D-3: coverage block reads 51/51/0 ----
d3_old=$(grep -cF '47 — 39 already complete' "$REQ")
d3_new=$(grep -cF '**In scope**: 51 — **51 complete, 0 open**' "$REQ")
d3_mapped=$(grep -cF 'Mapped to phases: 51' "$REQ")
d3_ok=1; d3_detail=""
eq "$d3_old" 0 || { d3_ok=0; d3_detail+="stale 47/39/8 coverage line still present; "; }
eq "$d3_new" 1 || { d3_ok=0; d3_detail+="51/51/0 coverage line count is ${d3_new}, expected 1; "; }
eq "$d3_mapped" 1 || { d3_ok=0; d3_detail+="'Mapped to phases: 51' count is ${d3_mapped}, expected 1; "; }
report "D-3" "$d3_ok" "$d3_detail"

# ---- D-4: ROADMAP.md Phase 7 checkbox/text (plan 08.1-02's ownership) ----
d4_checkbox=$(grep -cE '^- \[ \] \*\*Phase 7' "$ROAD")
d4_notcomplete=$(grep -cF 'NOT complete)' "$ROAD")
d4_ok=1; d4_detail=""
eq "$d4_checkbox" 0 || { d4_ok=0; d4_detail+="unchecked Phase 7 heading checkbox count is ${d4_checkbox}, expected 0; "; }
eq "$d4_notcomplete" 0 || { d4_ok=0; d4_detail+="'NOT complete)' count is ${d4_notcomplete}, expected 0; "; }
report "D-4" "$d4_ok" "$d4_detail"

# ---- D-5: STATE.md progress numbers (plan 08.1-02's ownership) ----
# D-5's original sub-check here was a bare `] 78%` literal-substring match.
# Corrected 2026-08-19 by Phase 8.1 plan 05 (RESIDUAL-1): that literal broke
# a second time when this project's own `state.*` SDK commands legitimately
# recomputed STATE.md's frontmatter `percent` from disk-ground-truth (89%,
# once Phase 8.1's own 5th plan landed on disk) -- a correct value change,
# not a regression. The bare-number assertion could not tell the difference
# between "drifted to a wrong number" and "correctly advanced to a new
# number", so it is replaced with the actual invariant criterion 4 cares
# about: the STATE.md body Progress line and its own frontmatter `percent`
# must always agree with each other, whatever the current number is.
d5_71=$(grep -cF '71%' "$STATE")
d5_body_pct=$(grep -oE '^Progress: \[.*\] [0-9]+%' "$STATE" | grep -oE '[0-9]+%$' | tr -d '%' | head -1)
d5_fm_pct=$(grep -oE '^  percent: [0-9]+' "$STATE" | grep -oE '[0-9]+$' | head -1)
d5_pct_match=0
if [ -n "$d5_body_pct" ] && [ -n "$d5_fm_pct" ] && [ "$d5_body_pct" -eq "$d5_fm_pct" ]; then d5_pct_match=1; fi
# Corrected 2026-08-19 (second occurrence of the same brittleness class plan 05 fixed
# for the percentage): the literal 'Total plans completed: 76' broke when the
# orchestrator's own `phase.complete "08.1"` legitimately advanced the count to 81
# (76 predated Phase 8.1's own five plans; 76 + 5 = 81, and the per-phase table sums
# to 81). A hardcoded count cannot distinguish "drifted wrong" from "correctly
# advanced", so assert the invariant instead: the body's plan-count line must equal
# the frontmatter's own `completed_plans`, whatever the number is.
d5_body_plans=$(grep -oE '^- Total plans completed: [0-9]+' "$STATE" | grep -oE '[0-9]+$' | head -1)
d5_fm_plans=$(grep -oE '^  completed_plans: [0-9]+' "$STATE" | grep -oE '[0-9]+$' | head -1)
d5_76=0
if [ -n "$d5_body_plans" ] && [ -n "$d5_fm_plans" ] && [ "$d5_body_plans" -eq "$d5_fm_plans" ]; then d5_76=1; fi
d5_lastphase=$(grep -cF 'Phase 08 is the last phase' "$STATE")
d5_ph07=$(grep -cE '^\| 07 \| 18 \|' "$STATE")
d5_ok=1; d5_detail=""
eq "$d5_71" 0 || { d5_ok=0; d5_detail+="stale '71%' count is ${d5_71}, expected 0; "; }
eq "$d5_pct_match" 1 || { d5_ok=0; d5_detail+="STATE.md body Progress (${d5_body_pct:-<none>}%) and frontmatter percent (${d5_fm_pct:-<none>}%) disagree; "; }
eq "$d5_76" 1 || { d5_ok=0; d5_detail+="STATE.md body plan count (${d5_body_plans:-<none>}) and frontmatter completed_plans (${d5_fm_plans:-<none>}) disagree; "; }
eq "$d5_lastphase" 0 || { d5_ok=0; d5_detail+="'Phase 08 is the last phase' count is ${d5_lastphase}, expected 0; "; }
eq "$d5_ph07" 1 || { d5_ok=0; d5_detail+="Phase 07 metrics row count is ${d5_ph07}, expected 1; "; }
report "D-5" "$d5_ok" "$d5_detail"

# ---- D-6: 3 (not 2) impossible tools, 29 (not 28) tools called, 33 (not 34) uncalled ----
d6_r28=$(grep -cF 'The skills call 28 tools' "$ROAD")
d6_q28=$(grep -cF 'The skills call **28** tools' "$REQ")
d6_s28=$(grep -cF 'six skills call 28 tools' "$STATE")
d6_r34=$(grep -cF '34 tools' "$ROAD")
d6_q34=$(grep -cF '34 tools' "$REQ")
d6_s34=$(grep -cF '34 tools' "$STATE")
d6_3imp=$(grep -cF '**3** are provably impossible' "$REQ")
d6_twoexcl=$(grep -cF 'two exclusive' "$ROAD")
d6_ok=1; d6_detail=""
eq "$d6_r28" 0 || { d6_ok=0; d6_detail+="ROADMAP.md 'skills call 28 tools' count is ${d6_r28}, expected 0; "; }
eq "$d6_q28" 0 || { d6_ok=0; d6_detail+="REQUIREMENTS.md 'skills call **28** tools' count is ${d6_q28}, expected 0; "; }
eq "$d6_s28" 0 || { d6_ok=0; d6_detail+="STATE.md 'six skills call 28 tools' count is ${d6_s28}, expected 0; "; }
eq "$d6_r34" 0 || { d6_ok=0; d6_detail+="ROADMAP.md '34 tools' count is ${d6_r34}, expected 0; "; }
eq "$d6_q34" 0 || { d6_ok=0; d6_detail+="REQUIREMENTS.md '34 tools' count is ${d6_q34}, expected 0; "; }
eq "$d6_s34" 0 || { d6_ok=0; d6_detail+="STATE.md '34 tools' count is ${d6_s34}, expected 0; "; }
eq "$d6_3imp" 1 || { d6_ok=0; d6_detail+="REQUIREMENTS.md '**3** are provably impossible' count is ${d6_3imp}, expected 1; "; }
eq "$d6_twoexcl" 1 || { d6_ok=0; d6_detail+="ROADMAP.md 'two exclusive' count is ${d6_twoexcl}, expected 1 (must stay preserved); "; }
report "D-6" "$d6_ok" "$d6_detail"

# ---- D-7: stock manifest tool count annotated as-of-cut (26) with current (38) noted ----
d7_r38=$(grep -cF 'ships **38** tools' "$ROAD")
d7_r26=$(grep -cF '26 tools' "$ROAD")
d7_q38=$(grep -cF 'ships **38** tools' "$REQ")
d7_q26=$(grep -cF '26 tools' "$REQ")
d7_ok=1; d7_detail=""
eq "$d7_r38" 1 || { d7_ok=0; d7_detail+="ROADMAP.md 'ships **38** tools' count is ${d7_r38}, expected 1; "; }
ge "$d7_r26" 1 || { d7_ok=0; d7_detail+="ROADMAP.md '26 tools' count is ${d7_r26}, expected >= 1; "; }
eq "$d7_q38" 1 || { d7_ok=0; d7_detail+="REQUIREMENTS.md 'ships **38** tools' count is ${d7_q38}, expected 1; "; }
ge "$d7_q26" 1 || { d7_ok=0; d7_detail+="REQUIREMENTS.md '26 tools' count is ${d7_q26}, expected >= 1; "; }
report "D-7" "$d7_ok" "$d7_detail"

echo "---"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "TOTAL FAILING ITEMS: ${FAIL_COUNT} of 7"
  exit 1
else
  echo "ALL 7 ITEMS PASS"
  exit 0
fi
