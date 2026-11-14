import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// crop-images.ts calls `require("….webp")`, which Metro handles but Node cannot, so this test reads
// the file as text and checks the list against assets/data/crops.json and the files on disk.
// (JSON is read from disk too: Node's test runner can't import JSON without import attributes.)
const library = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as {
  crops: { id: string }[];
};
const source = readFileSync(join(process.cwd(), "src", "data", "crop-images.ts"), "utf8");

// `"lowland-rice": require("../../assets/crops/lowland-rice.webp"),` or `corn: null,`
const entries = [...source.matchAll(/^\s+"?([a-z0-9-]+)"?: (null|require\("\.\.\/\.\.\/assets\/crops\/([a-z0-9-]+\.webp)"\)),$/gm)].map(
  (m) => ({ id: m[1], file: m[3] as string | undefined }),
);

test("every crop in the library has an entry in the picture list", () => {
  const ids = new Set(entries.map((e) => e.id));
  for (const c of library.crops) assert.ok(ids.has(c.id), `${c.id} is missing from crop-images.ts`);
});

test("the picture list has no crop that is not in the library", () => {
  const ids = new Set(library.crops.map((c) => c.id));
  for (const e of entries) assert.ok(ids.has(e.id), `${e.id} is not in crops.json`);
});

// #169 acceptance: every library crop shows a picture; a crop added to the library without one fails.
test("every crop in the library has a real picture file, named after the crop, that is small", () => {
  for (const c of library.crops) {
    const e = entries.find((x) => x.id === c.id);
    assert.ok(e?.file, `${c.id} has no picture yet`);
    assert.equal(e.file, `${c.id}.webp`);
    const path = join(process.cwd(), "assets", "crops", e.file);
    assert.ok(existsSync(path), `${path} is missing`);
    assert.ok(statSync(path).size <= 100 * 1024, `${e.file} is over 100 KB`);
  }
});

test("every picture is credited in THIRD_PARTY.md (rule 3)", () => {
  const credits = readFileSync(join(process.cwd(), "..", "THIRD_PARTY.md"), "utf8");
  for (const e of entries) {
    if (e.file) assert.ok(credits.includes(`assets/crops/${e.file}`), `${e.file} is not credited in THIRD_PARTY.md`);
  }
});
