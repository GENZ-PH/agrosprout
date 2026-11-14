/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import type { LotCrop } from "../types";
import {
  cropShortName,
  dataLine,
  isOtherCrop,
  lotsWithoutCrops,
  otherCropId,
  otherCropName,
  toggleCrop,
  chooseCrop,
} from "./crop-picks";

test("toggling adds a crop with no months, and removes it again; other crops keep their months", () => {
  const rice: LotCrop = { crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] };
  const added = toggleCrop([rice], "mungbean");
  assert.deepEqual(added, [rice, { crop_id: "mungbean", seasons: [] }]);
  assert.deepEqual(toggleCrop(added, "mungbean"), [rice]);
  assert.deepEqual(toggleCrop(added, "lowland-rice"), [{ crop_id: "mungbean", seasons: [] }]);
});

test("chooseCrop leaves only the chosen crop on the lot (one crop per lot, D13)", () => {
  const rice: LotCrop = { crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 9 }] };
  const mung: LotCrop = { crop_id: "mungbean", seasons: [] };
  assert.deepEqual(chooseCrop([], "corn"), [{ crop_id: "corn", seasons: [] }]);
  assert.deepEqual(chooseCrop([rice], "other:Cassava"), [{ crop_id: "other:Cassava", seasons: [] }], "a new pick replaces");
  assert.deepEqual(chooseCrop([rice, mung], "lowland-rice"), [rice], "from an older farm with several crops, the chosen one keeps its months");
  const one = [rice];
  assert.equal(chooseCrop(one, "lowland-rice"), one, "choosing the same crop again changes nothing");
});

test("+ Other crops are saved as other:<name>", () => {
  assert.equal(otherCropId("  Cassava   root "), "other:Cassava root");
  assert.equal(otherCropId("   "), null);
  assert.equal(isOtherCrop("other:Cassava"), true);
  assert.equal(isOtherCrop("corn"), false);
  assert.equal(otherCropName("other:Cassava"), "Cassava");
});

test("short crop names drop the bracketed part", () => {
  assert.equal(cropShortName({ name: "Lowland rice (irrigated or rainfed paddy)" }), "Lowland rice");
  assert.equal(cropShortName({ name: "Corn" }), "Corn");
});

test("lots without crops", () => {
  const lots = [
    { name: "Lot 1", crops: [{ crop_id: "corn", seasons: [] }] },
    { name: "Lot 2", crops: [] },
  ];
  assert.deepEqual(
    lotsWithoutCrops(lots).map((l) => l.name),
    ["Lot 2"],
  );
});

test("the data line follows data_status and the connection", () => {
  assert.equal(dataLine("ready", false).tone, "ready");
  assert.equal(dataLine("error", true).tone, "error");
  assert.match(dataLine("pending", true).text, /Getting NASA climate data/);
  assert.match(dataLine("pending", false).text, /Waiting for internet/);
});
