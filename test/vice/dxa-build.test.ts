// dxa-build.test.ts -- vendor/dxa/build.bash, hermetic.
//
// Each case copies build.bash into a scratch directory with a pin that
// matches a small fake tarball. The fake tarball has a Makefile that makes a
// shell-script `dxa` which prints a fixed listing. A fake `curl` on PATH
// copies the fake tarball, so no case uses the network, and XDG_CACHE_HOME
// points into the scratch directory, so no case touches the real cache.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { VICE_DIR } from "./paths.ts";

const BUILD_BASH = join(VICE_DIR, "vendor", "dxa", "build.bash");

/** The listing the pinned dxa 0.1.5 prints for build.bash's check image. */
const GOOD_LISTING = [
  "              \t.word $0801",
  "              \t* = $0801",
  "",
  "0801 0b 08 0a \t.byt $0b,$08,$0a",
  "0804 00 9e 32 \t.byt $00,$9e,$32",
  "0807 30 36 34 \t.byt $30,$36,$34",
  "080a 00 00 00 \t.byt $00,$00,$00",
  "080d 00 00 00 \t.byt $00,$00,$00",
  "0810          l810:",
  "0810 a9 00    \tlda #$00",
  "0812 8d 20 d0 \tsta $d020",
  "0815 60       \trts",
  "",
].join("\n");

interface Scratch {
  dir: string;
  vendor: string;
  cache: string;
  tarball: string;
  curlLog: string;
  run(env?: Record<string, string>): { status: number | null; stdout: string; stderr: string };
}

/** Make a fake dxa tarball whose `make` produces a `dxa` that prints `listing`. */
function makeTarball(dir: string, listing: string): string {
  const src = join(dir, "src", "dxa-0.1.5");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "listing.txt"), listing);
  writeFileSync(join(src, "dxa.in"), '#!/bin/sh\nexec cat "$(dirname "$0")/listing.txt"\n');
  writeFileSync(join(src, "Makefile"), "all:\n\tcp dxa.in dxa\n\tchmod +x dxa\n");
  const tarball = join(dir, "fake-dxa.tar.gz");
  const tar = spawnSync("tar", ["czf", tarball, "-C", join(dir, "src"), "dxa-0.1.5"], { encoding: "utf8" });
  assert.equal(tar.status, 0, tar.stderr);
  return tarball;
}

function withScratch(listing: string, fn: (s: Scratch) => void): () => void {
  return () => {
    const dir = mkdtempSync(join(tmpdir(), "dxa-build-"));
    try {
      const vendor = join(dir, "vendor", "dxa");
      mkdirSync(vendor, { recursive: true });
      copyFileSync(BUILD_BASH, join(vendor, "build.bash"));
      const tarball = makeTarball(dir, listing);
      const digest = createHash("sha256").update(readFileSync(tarball)).digest("hex");
      writeFileSync(join(vendor, "dxa-0.1.5.tar.gz.sha256"), `${digest}  dxa-0.1.5.tar.gz\n`);

      const bin = join(dir, "bin");
      mkdirSync(bin);
      const curlLog = join(dir, "curl.log");
      // The fake curl copies $FAKE_TARBALL to the -o path, or fails when
      // FAKE_CURL_FAIL is set. Each call appends one line to curl.log.
      writeFileSync(
        join(bin, "curl"),
        [
          "#!/bin/sh",
          'echo called >> "$FAKE_CURL_LOG"',
          'if [ -n "$FAKE_CURL_FAIL" ]; then exit 7; fi',
          'out=""',
          'while [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then out="$2"; shift; fi; shift; done',
          'cp "$FAKE_TARBALL" "$out"',
          "",
        ].join("\n"),
      );
      chmodSync(join(bin, "curl"), 0o755);

      const cache = join(dir, "xdg");
      const s: Scratch = {
        dir,
        vendor,
        cache: join(cache, "c64-re-tools", "dxa", "dxa-0.1.5.tar.gz"),
        tarball,
        curlLog,
        run(env = {}) {
          const r = spawnSync("bash", [join(vendor, "build.bash"), "build"], {
            encoding: "utf8",
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH ?? ""}`,
              XDG_CACHE_HOME: cache,
              FAKE_TARBALL: tarball,
              FAKE_CURL_LOG: curlLog,
              ...env,
            },
          });
          return { status: r.status, stdout: r.stdout, stderr: r.stderr };
        },
      };
      fn(s);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function curlCalls(s: Scratch): number {
  return existsSync(s.curlLog) ? readFileSync(s.curlLog, "utf8").split("\n").filter(Boolean).length : 0;
}

test(
  "build installs a dxa that gives the expected listing, whatever its bytes",
  withScratch(GOOD_LISTING, (s) => {
    const r = s.run();
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /functional check OK/);
    assert.ok(existsSync(join(s.vendor, "dxa")), "the checked binary is installed");
  }),
);

test(
  "build refuses a dxa whose listing differs and installs nothing",
  withScratch(GOOD_LISTING.replace("sta $d020", "sta $d021"), (s) => {
    const r = s.run();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unexpected listing for the check image/);
    assert.equal(existsSync(join(s.vendor, "dxa")), false);
  }),
);

test(
  "a verified download is cached and the next build uses the cache without a download",
  withScratch(GOOD_LISTING, (s) => {
    const first = s.run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(curlCalls(s), 1);
    assert.deepEqual(readFileSync(s.cache), readFileSync(s.tarball));

    rmSync(join(s.vendor, "dxa"));
    const second = s.run({ FAKE_CURL_FAIL: "1" });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(curlCalls(s), 1, "the second build made no download");
    assert.ok(existsSync(join(s.vendor, "dxa")));
  }),
);

test(
  "a download that does not match the pin is refused and not cached",
  withScratch(GOOD_LISTING, (s) => {
    writeFileSync(join(s.vendor, "dxa-0.1.5.tar.gz.sha256"), `${"0".repeat(64)}  dxa-0.1.5.tar.gz\n`);
    const r = s.run();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /tarball sha256 does not match the committed pin/);
    assert.equal(existsSync(s.cache), false);
    assert.equal(existsSync(join(s.vendor, "dxa")), false);
  }),
);

test(
  "a missing pin file is refused before any download",
  withScratch(GOOD_LISTING, (s) => {
    rmSync(join(s.vendor, "dxa-0.1.5.tar.gz.sha256"));
    const r = s.run();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /pin file missing/);
    assert.equal(curlCalls(s), 0);
  }),
);
