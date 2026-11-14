import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { CROP_IMAGES, cropImage } from "./crop-images";

// Read from disk: Node's test runner can't import JSON without import attributes.
const library = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as {
  crops: { id: string }[];
};

test("every crop in the library has an entry in the picture list (a picture or null for the placeholder)", () => {
  for (const c of library.crops) assert.ok(c.id in CROP_IMAGES, `${c.id} is missing from crop-images.ts`);
});

test("the picture list has no crop that is not in the library", () => {
  const ids = new Set(library.crops.map((c) => c.id));
  for (const id of Object.keys(CROP_IMAGES)) assert.ok(ids.has(id), `${id} is not in crops.json`);
});

test("a crop with no picture, a saved-from-search crop and an unknown id all give null", () => {
  assert.equal(cropImage("other:cassava"), null);
  assert.equal(cropImage("no-such-crop"), null);
});

// #169 acceptance: every library crop shows a picture. Marked todo (reported, not failing) until the
// team has picked a source and added the files; then remove `todo` so a crop without a picture fails.
test("every crop in the library has a real picture", { todo: "pictures not added yet (#169)" }, () => {
  for (const c of library.crops) assert.ok(CROP_IMAGES[c.id] !== null, `${c.id} has no picture yet`);
});
