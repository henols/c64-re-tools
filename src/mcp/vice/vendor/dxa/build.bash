#!/usr/bin/env bash
# build.bash
#
# Turns the pinned dxa 0.1.5 tarball into a built, checked `dxa` binary.
# Two verbs:
#
# `verify`: gets the pinned tarball (a cached copy is used when its sha256
# matches the pin; else it is downloaded) and checks its sha256 against the
# committed pin.
# `build`: does `verify`, runs `make` in a scratch extraction, then runs the
# built binary on a small inline C64 image and compares its listing with the
# known listing. Only a binary that gives that exact listing is installed as
# `vendor/dxa/dxa`. The check is on behaviour, not on the binary's bytes, so a
# different compiler, libc or architecture can build a correct dxa.
#
# Order of execution: both verbs read and validate the pin file before any
# download, so a run with no valid pin makes no network request.
#
# A downloaded tarball is written to the cache only after its sha256 matches
# the pin. The cache write goes through a temporary file and a rename, so a
# stopped run never leaves a partial cache file.
#
# Never commit the built binary or any `.o` file (both are gitignored).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIN_FILE="${HERE}/dxa-0.1.5.tar.gz.sha256"
TARBALL_URL="https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz"
CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/c64-re-tools/dxa"
CACHED_TARBALL="${CACHE_DIR}/dxa-0.1.5.tar.gz"

verb="${1:-}"
if [[ "${verb}" != "verify" && "${verb}" != "build" ]]; then
  echo "usage: build.bash {verify|build}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Pin-file gate. Read before any download, in either verb.
# ---------------------------------------------------------------------------
if [[ ! -f "${PIN_FILE}" ]]; then
  echo "build.bash: refusing -- pin file missing: ${PIN_FILE}" >&2
  echo "build.bash: no fetch was attempted; commit the pin before running this script" >&2
  exit 1
fi

pin_line="$(head -n1 "${PIN_FILE}" 2>/dev/null || true)"
pin_digest_raw="$(printf '%s' "${pin_line}" | awk '{print $1}')"
# Lowercase, full-length comparison: a truncated or non-hex digest is
# refused by name here, before it is compared to anything.
pin_digest="$(printf '%s' "${pin_digest_raw}" | tr '[:upper:]' '[:lower:]')"
if [[ ! "${pin_digest}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "build.bash: refusing -- pin file does not carry a well-formed 64-character lowercase hex sha256 (got: ${pin_digest_raw:-<empty>})" >&2
  echo "build.bash: no fetch was attempted" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Get the tarball into a scratch directory. Extraction, build and the
# functional check happen only in scratch; this directory gets only the
# final, checked binary.
# ---------------------------------------------------------------------------
scratch="$(mktemp -d)"
trap 'rm -rf "${scratch}"' EXIT

tarball="${scratch}/dxa-0.1.5.tar.gz"
downloaded=0

if [[ -f "${CACHED_TARBALL}" ]]; then
  cached_digest="$(sha256sum "${CACHED_TARBALL}" | awk '{print $1}')"
  if [[ "${cached_digest}" == "${pin_digest}" ]]; then
    cp "${CACHED_TARBALL}" "${tarball}"
    echo "build.bash: using cached tarball ${CACHED_TARBALL}"
  fi
fi

if [[ ! -f "${tarball}" ]]; then
  echo "build.bash: fetching ${TARBALL_URL}" >&2
  curl -fsSL -o "${tarball}" "${TARBALL_URL}"
  downloaded=1
fi

fetched_digest="$(sha256sum "${tarball}" | awk '{print $1}')"
echo "build.bash: pin digest      = ${pin_digest}"
echo "build.bash: tarball digest  = ${fetched_digest}"
if [[ "${fetched_digest}" != "${pin_digest}" ]]; then
  echo "build.bash: refusing -- tarball sha256 does not match the committed pin" >&2
  exit 1
fi

if [[ "${downloaded}" == "1" ]]; then
  # A cache that cannot be written only costs a download next time.
  if mkdir -p "${CACHE_DIR}" 2>/dev/null \
    && cp "${tarball}" "${CACHED_TARBALL}.tmp.$$" 2>/dev/null \
    && mv -f "${CACHED_TARBALL}.tmp.$$" "${CACHED_TARBALL}" 2>/dev/null; then
    echo "build.bash: cached the verified tarball at ${CACHED_TARBALL}"
  else
    rm -f "${CACHED_TARBALL}.tmp.$$" 2>/dev/null || true
    echo "build.bash: note -- could not write the tarball cache at ${CACHE_DIR}" >&2
  fi
fi

extract_dir="${scratch}/extracted"
mkdir -p "${extract_dir}"
tar xzf "${tarball}" --strip-components=1 -C "${extract_dir}"

if [[ "${verb}" == "verify" ]]; then
  echo "build.bash: verify OK"
  exit 0
fi

# ---------------------------------------------------------------------------
# build: compile in the scratch extraction, then check what the binary does.
# ---------------------------------------------------------------------------
(
  cd "${extract_dir}"
  make
)

if [[ ! -x "${extract_dir}/dxa" ]]; then
  echo "build.bash: refusing -- make did not produce an executable dxa" >&2
  exit 1
fi

# Functional check. The image is a 23-byte C64 program: load address $0801,
# a `10 SYS 2064` BASIC stub, three pad bytes, then LDA #$00 / STA $D020 /
# RTS at $0810. $0810 is given as the one known entry point. These are the
# same flags the host-tool seam passes, so a pass means the listing parser
# gets the lines it expects.
check_dir="${scratch}/check"
mkdir -p "${check_dir}"
printf '\001\010\013\010\012\000\236\062\060\066\064\000\000\000\000\000\000\251\000\215\040\320\140' \
  > "${check_dir}/check.prg"
printf '0810\n' > "${check_dir}/check.entrypoints"

expected="${check_dir}/expected.txt"
{
  printf '              \t.word $0801\n'
  printf '              \t* = $0801\n'
  printf '\n'
  printf '0801 0b 08 0a \t.byt $0b,$08,$0a\n'
  printf '0804 00 9e 32 \t.byt $00,$9e,$32\n'
  printf '0807 30 36 34 \t.byt $30,$36,$34\n'
  printf '080a 00 00 00 \t.byt $00,$00,$00\n'
  printf '080d 00 00 00 \t.byt $00,$00,$00\n'
  printf '0810          l810:\n'
  printf '0810 a9 00    \tlda #$00\n'
  printf '0812 8d 20 d0 \tsta $d020\n'
  printf '0815 60       \trts\n'
} > "${expected}"

actual="${check_dir}/actual.txt"
if ! "${extract_dir}/dxa" -p all-nmos6502 -d skip-scanning -t detect-internal \
  -R "${check_dir}/check.entrypoints" -a dump "${check_dir}/check.prg" > "${actual}" 2> "${check_dir}/stderr.txt"; then
  echo "build.bash: refusing -- the built dxa exited non-zero on the check image" >&2
  cat "${check_dir}/stderr.txt" >&2
  exit 1
fi

if ! cmp -s "${expected}" "${actual}"; then
  echo "build.bash: refusing -- the built dxa gave an unexpected listing for the check image" >&2
  diff -u "${expected}" "${actual}" >&2 || true
  exit 1
fi
echo "build.bash: functional check OK -- the built dxa gives the expected listing"

cp "${extract_dir}/dxa" "${HERE}/dxa.tmp.$$"
mv -f "${HERE}/dxa.tmp.$$" "${HERE}/dxa"
echo "build.bash: build OK -- ${HERE}/dxa"
