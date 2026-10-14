#!/bin/bash
# The checks of every scenario: the native tools run, and the toolkit is in the project.
set -e
# shellcheck disable=SC1091
source dev-container-features-test-lib

check "ACME runs" bash -c "acme --version | grep 'This is ACME, release 0.97'"
check "dxa runs" bash -c "dxa -h 2>&1 | grep 'v0.1.5 -- symbolic'"
check "Java 21" bash -c "java -version 2>&1 | grep 'version \"21'"
check "Ghidra runs" bash -c "\"\$C64RT_GHIDRA/support/analyzeHeadless\" 2>&1 | grep 'Headless Analyzer Usage'"
check "Ghidra has a decompiler for this machine" bash -c "ls \"\$C64RT_GHIDRA\"/Ghidra/Features/Decompiler/os/linux_*/decompile"
check "the toolkit is installed in the project" bash -c "ls .claude/skills/c64-reverse-engineering/SKILL.md .mcp.json"

reportResults
