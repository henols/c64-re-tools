#!/usr/bin/env bash
# Installs Ghidra in $DEST/ghidra_<version>_PUBLIC (DEST: /opt) and points
# $DEST/ghidra at it, so that C64RT_GHIDRA=$DEST/ghidra stays the same when
# the version changes. Removes the Ghidra versions that it installed before.
# Ghidra needs Java 21. Debian and Ubuntu.

set -Eeuo pipefail

GHIDRA_VERSION="12.1.3"
GHIDRA_ZIP="ghidra_${GHIDRA_VERSION}_PUBLIC_20260817.zip"
GHIDRA_URL="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/${GHIDRA_ZIP}"
GHIDRA_SHA256="93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54"
DEST="${DEST:-/opt}"
GHIDRA_DIR="${DEST}/ghidra_${GHIDRA_VERSION}_PUBLIC"

fail() {
    printf 'Ghidra: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -eq 0 || -w "${DEST}" ]] || fail "run as root, or set DEST to a folder that you can write."

if [[ ! -d "${GHIDRA_DIR}" ]]; then
    BUILD_DIR="$(mktemp -d -t ghidra-XXXXXXXX)"
    trap 'rm -rf "${BUILD_DIR}"' EXIT
    curl -fsSL --retry 3 -o "${BUILD_DIR}/${GHIDRA_ZIP}" "${GHIDRA_URL}"
    echo "${GHIDRA_SHA256}  ${BUILD_DIR}/${GHIDRA_ZIP}" | sha256sum -c - > /dev/null || fail "the archive has the wrong checksum."
    unzip -q "${BUILD_DIR}/${GHIDRA_ZIP}" -d "${BUILD_DIR}/unpacked"
    # Ghidra ships its decompiler only for x86-64; on arm64 its own Gradle wrapper builds it.
    if [[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]]; then
        (cd "${BUILD_DIR}/unpacked/ghidra_${GHIDRA_VERSION}_PUBLIC/support/gradle" && GRADLE_USER_HOME="${BUILD_DIR}/gradle" ./gradlew --no-daemon buildNatives)
    fi
    mv "${BUILD_DIR}/unpacked/ghidra_${GHIDRA_VERSION}_PUBLIC" "${GHIDRA_DIR}"
fi

ln -sfn "${GHIDRA_DIR}" "${DEST}/ghidra"
for old in "${DEST}"/ghidra_*_PUBLIC; do
    [[ "${old}" == "${GHIDRA_DIR}" || ! -d "${old}" ]] || rm -rf "${old}"
done
echo "Ghidra ${GHIDRA_VERSION} is installed in ${GHIDRA_DIR}, and ${DEST}/ghidra points at it."
