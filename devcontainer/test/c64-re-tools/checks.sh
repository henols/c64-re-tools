#!/bin/bash
# The checks of every scenario: the native tools run, and the toolkit is in the project.
set -e
# shellcheck disable=SC1091
source dev-container-features-test-lib

check "ACME runs" bash -c "acme --version | grep 'This is ACME, release 0.97'"
check "dxa runs" bash -c "dxa -h 2>&1 | grep 'v0.1.5 -- symbolic'"
check "Exomizer runs" bash -c "exomizer -v 2>&1 | grep 'Exomizer v3.1.2 '"
check "c64run runs and has its ROMs" bash -c "c64run --version | grep '^roms=ok '"
check "c64run starts the C64 with its ROMs" bash -c "printf 'init\\nquit\\n' | c64run | grep '^ok .*pc=fce2'"
check "Java 21" bash -c "java -version 2>&1 | grep 'version \"21'"
check "Ghidra runs" bash -c "\"\$C64RT_GHIDRA/support/analyzeHeadless\" 2>&1 | grep 'Headless Analyzer Usage'"
check "Ghidra has a decompiler for this machine" bash -c "ls \"\$C64RT_GHIDRA\"/Ghidra/Features/Decompiler/os/linux_*/decompile"
check "the tools are stamped with the toolkit version" bash -c "test -s /usr/local/share/c64-re-tools/tools.version && ls /usr/local/share/c64-re-tools/stamps/dxa /usr/local/share/c64-re-tools/stamps/exomizer /usr/local/share/c64-re-tools/stamps/c64run /usr/local/share/c64-re-tools/stamps/ghidra"
check "a start with the same version installs no tools" bash -c "! /usr/local/share/c64-re-tools/project.sh update 2>&1 | grep 'installing the native tools'"
check "the toolkit is installed in the project" bash -c "ls .claude/skills/c64-reverse-engineering/SKILL.md .mcp.json"

reportResults
