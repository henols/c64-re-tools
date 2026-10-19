#!/usr/bin/env bash
# Builds sjasmplus, the Z80 assembler of the ZX Spectrum skills, from its
# release source and installs $PREFIX/bin/sjasmplus (PREFIX: /usr/local).
# Needs a C++ compiler, make, curl and xz, and write access to PREFIX.

set -Eeuo pipefail

SJASMPLUS_VERSION="1.24.0"
SJASMPLUS_URL="https://github.com/z00m128/sjasmplus/releases/download/v${SJASMPLUS_VERSION}/sjasmplus-${SJASMPLUS_VERSION}-src.tar.xz"
SJASMPLUS_SHA256="0b5013f07e8d8505f9e296529655668b6fdf0268625c19e883b0fff484e209f1"
PREFIX="${PREFIX:-/usr/local}"

fail() {
    printf 'sjasmplus: %s\n' "$*" >&2
    exit 1
}

[[ -w "${PREFIX}" ]] || fail "${PREFIX} is not writable: run as root or set PREFIX."

BUILD_DIR="$(mktemp -d -t sjasmplus-build-XXXXXXXX)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

curl -fsSL --retry 3 -o "${BUILD_DIR}/src.tar.xz" "${SJASMPLUS_URL}"
[[ "$(sha256sum "${BUILD_DIR}/src.tar.xz" | cut -d' ' -f1)" == "${SJASMPLUS_SHA256}" ]] || fail "the source archive has the wrong checksum. Refusing to compile it."
tar -xJf "${BUILD_DIR}/src.tar.xz" -C "${BUILD_DIR}"

make -C "${BUILD_DIR}/sjasmplus-${SJASMPLUS_VERSION}" -j"$(nproc)" > "${BUILD_DIR}/build.log" 2>&1 || { tail -20 "${BUILD_DIR}/build.log" >&2; fail "the build failed."; }
built="${BUILD_DIR}/sjasmplus-${SJASMPLUS_VERSION}/sjasmplus"
# --version writes to stderr and exits with 1.
[[ "$("${built}" --version 2>&1 || true)" == *"v${SJASMPLUS_VERSION}"* ]] || fail "the compiled sjasmplus does not give its version."

install -d -m 0755 "${PREFIX}/bin"
install -m 0755 "${built}" "${PREFIX}/bin/sjasmplus"
echo "sjasmplus ${SJASMPLUS_VERSION} is installed in ${PREFIX}/bin/sjasmplus."
