#!/usr/bin/env bash
# Builds zxrun, the ZX Spectrum 48K replay core: floooh/chips zx.h at the commit
# that c64run uses, with the line-command harness zxrun.c next to this script.
# Installs $PREFIX/bin/zxrun and the 48K ROM that it loads to
# $PREFIX/share/c64-re-tools/roms (PREFIX: /usr/local). Needs a C compiler and
# curl, and write access to PREFIX.

set -Eeuo pipefail

CHIPS_COMMIT="9e88298ce56319953ac7a43213a1120359f7a3a6"
CHIPS_URL="https://codeload.github.com/floooh/chips/tar.gz/${CHIPS_COMMIT}"
CHIPS_SHA256="fcae39995f61bfe461175047b11f16d147be0e7353c8a247ac503b5fd3a09b8d"
# The 48K ROM (Amstrad permits its distribution with emulators), from the
# ZEsarUX 13.0 source tree.
ROM_URL="https://raw.githubusercontent.com/chernandezba/zesarux/ZEsarUX-13.0/src/48.rom"
ROM_SHA256="d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
PREFIX="${PREFIX:-/usr/local}"
HERE="$(cd "$(dirname "$0")" && pwd)"

fail() {
    printf 'zxrun: %s\n' "$*" >&2
    exit 1
}

[[ -w "${PREFIX}" ]] || fail "${PREFIX} is not writable: run as root or set PREFIX."

check() {
    [[ "$(sha256sum "$2" | cut -d' ' -f1)" == "$1" ]]
}

BUILD_DIR="$(mktemp -d -t zxrun-build-XXXXXXXX)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

curl -fsSL --retry 3 -o "${BUILD_DIR}/chips.tgz" "${CHIPS_URL}"
check "${CHIPS_SHA256}" "${BUILD_DIR}/chips.tgz" || fail "the chips archive has the wrong checksum. Refusing to compile it."
tar -xzf "${BUILD_DIR}/chips.tgz" -C "${BUILD_DIR}"

mkdir -p "${BUILD_DIR}/roms"
curl -fsSL --retry 3 -o "${BUILD_DIR}/roms/48.rom" "${ROM_URL}"
check "${ROM_SHA256}" "${BUILD_DIR}/roms/48.rom" || fail "the ROM 48.rom has the wrong checksum."

gcc -O2 -Wall -Wno-unused-function -DCHIPS_COMMIT="\"${CHIPS_COMMIT:0:12}\"" \
    -I "${BUILD_DIR}/chips-${CHIPS_COMMIT}" -o "${BUILD_DIR}/zxrun" "${HERE}/zxrun.c"
started="$(printf 'init %s\nquit\n' "${BUILD_DIR}/roms" | "${BUILD_DIR}/zxrun")"
[[ "${started}" == ok*pc=0000* ]] || fail "the compiled zxrun does not reach the reset address: ${started}"

install -d -m 0755 "${PREFIX}/bin" "${PREFIX}/share/c64-re-tools/roms"
install -m 0755 "${BUILD_DIR}/zxrun" "${PREFIX}/bin/zxrun"
install -m 0644 "${BUILD_DIR}/roms/48.rom" "${PREFIX}/share/c64-re-tools/roms/"
echo "zxrun (chips ${CHIPS_COMMIT:0:12}) is installed in ${PREFIX}/bin/zxrun, its ROM in ${PREFIX}/share/c64-re-tools/roms."
