#!/usr/bin/env bash
# The c64-re-tools dev container Feature: the native tools of the skill
# scripts at image build time, and a script that installs the toolkit into
# the project after create and updates it on each start (D38). Node 24 and
# Java 21 come from the official Node and Java Features (dependsOn).

set -Eeuo pipefail

GHIDRA_VERSION="12.1.3"
GHIDRA_ZIP="ghidra_${GHIDRA_VERSION}_PUBLIC_20260817.zip"
GHIDRA_URL="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/${GHIDRA_ZIP}"
GHIDRA_SHA256="93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54"
GHIDRA_DIR="/opt/ghidra_${GHIDRA_VERSION}_PUBLIC"
SHARE="/usr/local/share/c64-re-tools"

TARGET="${TARGET:-claude}"
CHANNEL="${CHANNEL:-latest}"

fail() {
    printf 'c64-re-tools Feature: %s\n' "$*" >&2
    exit 1
}

[[ "${TARGET}" =~ ^[a-z]+(,[a-z]+)*$ ]] || fail "target must be a harness name or a comma list of them, not '${TARGET}'."
[[ "${CHANNEL}" == latest || "${CHANNEL}" == next ]] || fail "channel must be latest or next, not '${CHANNEL}'."

# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == debian || "${ID:-}" == ubuntu || "${ID_LIKE:-}" == *debian* ]] || fail "only Debian and Ubuntu images are supported, not ${ID:-an unknown system}."

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends acme unzip curl ca-certificates

# dxa has no package: the same script as the install page builds it.
bash "$(dirname "$0")/install-dxa.sh"

curl -fsSL --retry 3 -o "/tmp/${GHIDRA_ZIP}" "${GHIDRA_URL}"
echo "${GHIDRA_SHA256}  /tmp/${GHIDRA_ZIP}" | sha256sum -c -
unzip -q "/tmp/${GHIDRA_ZIP}" -d /opt
rm "/tmp/${GHIDRA_ZIP}"

# Ghidra ships its decompiler only for x86-64; on arm64 its own Gradle wrapper builds it.
if [[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]]; then
    apt-get install -y --no-install-recommends build-essential
    (cd "${GHIDRA_DIR}/support/gradle" && ./gradlew --no-daemon buildNatives)
    rm -rf /root/.gradle
fi
rm -rf /var/lib/apt/lists/*

# The lifecycle commands cannot read the options, so the chosen ones are written into the script.
mkdir -p "${SHARE}"
cat > "${SHARE}/project.sh" <<EOF
#!/bin/sh
# Installs (install) or updates (update) c64-re-tools in the project, for: ${TARGET}.
case "\$1" in
    install) exec npx -y "@henols/c64-re-tools@${CHANNEL}" install --target "${TARGET}" ;;
    update) npx -y "@henols/c64-re-tools@${CHANNEL}" update --target "${TARGET}" || echo "c64-re-tools: the update failed; the installed copy stays." >&2 ;;
    *) echo "usage: project.sh install|update" >&2; exit 2 ;;
esac
EOF
chmod 0755 "${SHARE}/project.sh"
