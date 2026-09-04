#!/usr/bin/env bash
# build.bash
#
# Phase 35, plan 35-01 (DXA-01): THIS IS THE ONE AUTHORITATIVE PLACE that
# turns the pinned dxa 0.1.5 tarball into a built, digest-verified `dxa`
# binary. Two verbs, `verify` and `build`, both gated by a sha256 DIGEST
# COMPARISON -- never by whether a spawned command merely exited zero. A
# spawned command (curl, tar, make) can succeed while producing the wrong
# bytes (a stale cache, a corrupted download, a toolchain drift); a digest
# comparison cannot lie that way, so it is the only signal either verb
# trusts to decide pass/fail.
#
# `verify`: re-materialises the pinned tarball (a cached copy is reused
# when its digest already matches the pin; fetched otherwise), checks it
# against the committed pin, and asserts the extracted tree is byte-
# identical to the committed src/mcp/vice/vendor/dxa/ source files.
# `build`: runs `make` in the vendored tree and compares the produced
# binary's sha256 against the pinned build digest.
#
# ORDER OF EXECUTION, not merely order in the file: both verbs read the pin
# file and refuse BY NAME when it is absent or malformed BEFORE any `curl`
# runs -- a run with no pin file makes no network request at all.
#
# WHAT NOT TO DO:
#   - Never decide pass/fail from a spawned command's exit status alone
#     where a digest is available -- `sha256sum -c`'s own exit code is
#     read here, but only ever as a companion to printing the two digests
#     being compared, never as the sole signal for `make`'s own success.
#   - Never fetch before the pin file has been read and validated.
#   - Never commit the built binary or any `.o` object file -- see the two
#     `.gitignore` entries this same commit adds.
#   - Never silently accept a truncated or upper-case-mismatched digest --
#     digest comparison lowercases and compares the full 64-character hex
#     string, never a prefix.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIN_FILE="${HERE}/dxa-0.1.5.tar.gz.sha256"
TARBALL_URL="https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz"
CACHE_DIR="${HOME}/.cache/c64-re-tools/phase23"
CACHED_TARBALL="${CACHE_DIR}/dxa-0.1.5.tar.gz"
BUILT_BINARY_SHA256="0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523"

verb="${1:-}"
if [[ "${verb}" != "verify" && "${verb}" != "build" ]]; then
  echo "usage: build.bash {verify|build}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Pin-file gate. Read BEFORE any fetch is attempted, in EITHER verb -- the
# order of these lines is the order of execution, not just narrative.
# ---------------------------------------------------------------------------
if [[ ! -f "${PIN_FILE}" ]]; then
  echo "build.bash: refusing -- pin file missing: ${PIN_FILE}" >&2
  echo "build.bash: no fetch was attempted; commit the pin before running this script" >&2
  exit 1
fi

pin_line="$(head -n1 "${PIN_FILE}" 2>/dev/null || true)"
pin_digest_raw="$(printf '%s' "${pin_line}" | awk '{print $1}')"
# Lowercase, exact-length comparison: never a prefix match, never
# case-sensitive-only. A truncated (e.g. 32-character) or non-hex digest is
# refused BY NAME here, before it is ever compared to anything.
pin_digest="$(printf '%s' "${pin_digest_raw}" | tr '[:upper:]' '[:lower:]')"
if [[ ! "${pin_digest}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "build.bash: refusing -- pin file does not carry a well-formed 64-character lowercase hex sha256 (got: ${pin_digest_raw:-<empty>})" >&2
  echo "build.bash: no fetch was attempted" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Materialise the tarball into a scratch directory. Extraction and
# verification happen ONLY in scratch -- the committed tree under vendor/dxa/
# is read here, never written, so a second concurrent run can at worst
# repeat work, never corrupt the committed source.
# ---------------------------------------------------------------------------
scratch="$(mktemp -d)"
trap 'rm -rf "${scratch}"' EXIT

tarball="${scratch}/dxa-0.1.5.tar.gz"

if [[ -f "${CACHED_TARBALL}" ]]; then
  cached_digest="$(sha256sum "${CACHED_TARBALL}" | awk '{print $1}')"
  if [[ "${cached_digest}" == "${pin_digest}" ]]; then
    cp "${CACHED_TARBALL}" "${tarball}"
  fi
fi

if [[ ! -f "${tarball}" ]]; then
  echo "build.bash: fetching ${TARBALL_URL}" >&2
  curl -fsSL -o "${tarball}" "${TARBALL_URL}"
fi

fetched_digest="$(sha256sum "${tarball}" | awk '{print $1}')"
echo "build.bash: pin digest      = ${pin_digest}"
echo "build.bash: tarball digest  = ${fetched_digest}"
if [[ "${fetched_digest}" != "${pin_digest}" ]]; then
  echo "build.bash: refusing -- tarball sha256 does not match the committed pin" >&2
  exit 1
fi

extract_dir="${scratch}/extracted"
mkdir -p "${extract_dir}"
tar xzf "${tarball}" --strip-components=1 -C "${extract_dir}"

# Byte-identical check: every committed vendored file must match the
# freshly extracted tree exactly. A committed file the tarball no longer
# carries, or an extracted file the commit is missing, is also a failure --
# `diff -r` catches both, not merely a per-file content compare.
committed_dir="${HERE}"
diff_output="$(diff -rq \
  --exclude="dxa-0.1.5.tar.gz.sha256" \
  --exclude="build.bash" \
  --exclude="README.md" \
  --exclude="dxa" \
  --exclude="*.o" \
  "${committed_dir}" "${extract_dir}" 2>&1 || true)"
if [[ -n "${diff_output}" ]]; then
  echo "build.bash: refusing -- extracted tree is not byte-identical to the committed vendor/dxa/ source" >&2
  echo "${diff_output}" >&2
  exit 1
fi
echo "build.bash: extracted tree is byte-identical to the committed vendor/dxa/ source"

if [[ "${verb}" == "verify" ]]; then
  echo "build.bash: verify OK"
  exit 0
fi

# ---------------------------------------------------------------------------
# build: compile in the SCRATCH extraction (never in the committed tree --
# the committed tree is read-only to this script), then digest-compare the
# produced binary against the pinned build digest.
# ---------------------------------------------------------------------------
(
  cd "${extract_dir}"
  make
)

built_digest="$(sha256sum "${extract_dir}/dxa" | awk '{print $1}')"
echo "build.bash: pinned binary digest = ${BUILT_BINARY_SHA256}"
echo "build.bash: built binary digest  = ${built_digest}"
if [[ "${built_digest}" != "${BUILT_BINARY_SHA256}" ]]; then
  echo "build.bash: refusing -- built binary sha256 does not match the pinned digest" >&2
  exit 1
fi

cp "${extract_dir}/dxa" "${HERE}/dxa"
echo "build.bash: build OK -- ${HERE}/dxa"
