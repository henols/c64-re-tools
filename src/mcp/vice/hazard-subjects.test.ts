// hazard-subjects.test.ts -- the closed hazard-subject table vice_program_load reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  HAZARD_SUBJECT_IDS,
  HAZARD_SUBJECT_PRG_BASENAMES,
  HAZARD_SUBJECT_PRG_RELPATHS,
  hazardSubjectPrgPath,
  isHazardSubjectId,
} from "./hazard-subjects.ts";

test("every hazard subject resolves to a committed file, and every row is a reviewed literal that cannot climb out of the repository", () => {
  for (const id of HAZARD_SUBJECT_IDS) {
    const path = hazardSubjectPrgPath(id);
    assert.ok(existsSync(path), `subject ${JSON.stringify(id)} must resolve to a real file on disk (${path})`);
    assert.ok(path.endsWith(HAZARD_SUBJECT_PRG_BASENAMES[id]), "the resolved path must end in the table's own derived basename");
    assert.ok(path.includes(join("src", "mcp", "vice", "fixtures", "hazard-subject")), `subject ${JSON.stringify(id)} must live under the fixture directory`);

    const segments = HAZARD_SUBJECT_PRG_RELPATHS[id];
    assert.ok(Object.isFrozen(segments), `subject ${JSON.stringify(id)}'s segment list must be frozen`);
    for (const segment of segments) {
      assert.ok(segment !== "" && segment !== "." && segment !== "..", `subject ${JSON.stringify(id)} has an unsafe segment ${JSON.stringify(segment)}`);
      assert.ok(!segment.includes("/") && !segment.includes("\\"), `no segment of ${JSON.stringify(id)} may carry a path separator (${segment})`);
    }
  }
  assert.deepEqual(Object.keys(HAZARD_SUBJECT_PRG_BASENAMES).sort(), [...HAZARD_SUBJECT_IDS].sort());
});

test("isHazardSubjectId admits exactly the table's ids -- not the committed misaligned fixture, and nothing on the prototype chain", () => {
  for (const id of HAZARD_SUBJECT_IDS) assert.ok(isHazardSubjectId(id));
  for (const notAnId of ["misaligned", "constructor", "__proto__", "toString", "", "ORIGINAL", 0, null, undefined, {}]) {
    assert.equal(isHazardSubjectId(notAnId), false, `${JSON.stringify(notAnId)} must not pass as a subject id`);
  }
});
