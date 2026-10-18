#!/usr/bin/env bash
# Builds c64run, the replay core of c64-testing: floooh/chips c64.h at a pinned
# commit with the line-command harness c64run.c next to this script. Installs
# /usr/local/bin/c64run and the three C64 ROMs that it loads to
# /usr/local/share/c64-re-tools/roms. install-container.sh runs it as root,
# with a C compiler and curl.

set -Eeuo pipefail

CHIPS_COMMIT="9e88298ce56319953ac7a43213a1120359f7a3a6"
CHIPS_URL="https://codeload.github.com/floooh/chips/tar.gz/${CHIPS_COMMIT}"
CHIPS_SHA256="fcae39995f61bfe461175047b11f16d147be0e7353c8a247ac503b5fd3a09b8d"
# The C64 ROMs from the Commodore firmware archive on zimmers.net, installed
# under the names that VICE uses (the bytes are the same as VICE's).
ROM_URL="https://www.zimmers.net/anonftp/pub/cbm/firmware/computers/c64"
ROMS=(
    "kernal.901227-03.bin kernal-901227-03.bin 83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721"
    "basic.901226-01.bin basic-901226-01.bin 89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d"
    "characters.901225-01.bin chargen-901225-01.bin fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420"
)
PREFIX="/usr/local"
HERE="$(cd "$(dirname "$0")" && pwd)"

fail() {
    printf 'c64run: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "run as root."

check() {
    [[ "$(sha256sum "$2" | cut -d' ' -f1)" == "$1" ]]
}

BUILD_DIR="$(mktemp -d -t c64run-build-XXXXXXXX)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

curl -fsSL --retry 3 -o "${BUILD_DIR}/chips.tgz" "${CHIPS_URL}"
check "${CHIPS_SHA256}" "${BUILD_DIR}/chips.tgz" || fail "the chips archive has the wrong checksum. Refusing to compile it."
tar -xzf "${BUILD_DIR}/chips.tgz" -C "${BUILD_DIR}"

mkdir -p "${BUILD_DIR}/roms"
for rom in "${ROMS[@]}"; do
    read -r source name sha <<< "${rom}"
    curl -fsSL --retry 3 -o "${BUILD_DIR}/roms/${name}" "${ROM_URL}/${source}"
    check "${sha}" "${BUILD_DIR}/roms/${name}" || fail "the ROM ${name} has the wrong checksum."
done

gcc -O2 -Wall -Wno-unused-function -DCHIPS_COMMIT="\"${CHIPS_COMMIT:0:12}\"" \
    -I "${BUILD_DIR}/chips-${CHIPS_COMMIT}" -o "${BUILD_DIR}/c64run" "${HERE}/c64run.c"
started="$(printf 'init %s\nquit\n' "${BUILD_DIR}/roms" | "${BUILD_DIR}/c64run")"
[[ "${started}" == ok*pc=fce2* ]] || fail "the compiled c64run does not reach the reset vector: ${started}"

install -d -m 0755 "${PREFIX}/bin" "${PREFIX}/share/c64-re-tools/roms"
install -m 0755 "${BUILD_DIR}/c64run" "${PREFIX}/bin/c64run"
install -m 0644 "${BUILD_DIR}"/roms/*.bin "${PREFIX}/share/c64-re-tools/roms/"
echo "c64run (chips ${CHIPS_COMMIT:0:12}) is installed in ${PREFIX}/bin/c64run, its ROMs in ${PREFIX}/share/c64-re-tools/roms."
