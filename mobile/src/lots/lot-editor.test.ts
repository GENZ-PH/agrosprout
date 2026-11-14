/// <reference types="node" />
// S1 lot editing on the real farm store logic (farm-core), without storage.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createStore, type StateCreator } from "zustand/vanilla";

import { farmStateCreator, type FarmState } from "../state/farm-core";
import type { LonLat, Travel } from "../types";
import { areaLabel, createLotEditor, isPinLot, lotRows, parseHectares, pinShape, type LotShape } from "./lot-editor";

function setup() {
  const removed: string[] = [];
  const creator = farmStateCreator({ removeKey: async (k) => void removed.push(k) });
  const farm = createStore<FarmState>()(creator as unknown as StateCreator<FarmState>);
  const editor = createLotEditor({
    getLots: () => farm.getState().lots,
    nextLotNumber: () => farm.getState().next_lot_number,
    addLot: (l) => farm.getState().addLot(l),
    updateLot: (id, p) => farm.getState().updateLot(id, p),
    deleteLot: (id) => farm.getState().deleteLot(id),
    setTravel: (id, t) => farm.getState().setTravel(id, t),
  });
  const rows = () => lotRows(farm.getState().lots, editor.getState().placeholders);
  return { farm, editor: editor.getState(), rows, removed };
}

/** A small square outline near Iligan (synthetic test shape, not a real lot). */
function square(lon: number, lat: number, area_ha: number): LotShape {
  const d = 0.001;
  const ring: LonLat[] = [
    [lon, lat],
    [lon + d, lat],
    [lon + d, lat + d],
    [lon, lat + d],
    [lon, lat],
  ];
  return { geometry: { type: "Polygon", coordinates: [ring] }, area_ha, centroid: [lon + d / 2, lat + d / 2] };
}

test("a new farm starts with a Lot 1 placeholder; a farm with lots does not", () => {
  const a = setup();
  a.editor.ensureStarted();
  a.editor.ensureStarted();
  assert.deepEqual(
    a.rows().map((r) => [r.id, r.name, r.area_ha]),
    [["new-1", "Lot 1", null]],
  );

  const b = setup();
  b.farm.getState().addLot(square(124.2, 8.2, 1));
  b.editor.ensureStarted();
  assert.deepEqual(
    b.rows().map((r) => r.id),
    ["lot-1"],
  );
});

test("drawing a placeholder saves it in the farm store under the farm id, as pending", () => {
  const { farm, editor, rows } = setup();
  editor.ensureStarted();
  const id = editor.setShape("new-1", square(124.2, 8.2, 1.2));
  assert.equal(id, "lot-1");
  const lot = farm.getState().lots[0];
  assert.equal(lot.name, "Lot 1");
  assert.equal(lot.area_ha, 1.2);
  assert.equal(lot.data_status, "pending"); // the lot sync fetches NASA data for it
  assert.deepEqual(
    rows().map((r) => r.id),
    ["lot-1"],
  );
});

test("placeholder names keep counting, and keep their name when drawn out of order", () => {
  const { farm, editor, rows } = setup();
  editor.ensureStarted();
  const lot2 = editor.addPlaceholder();
  assert.equal(lot2.name, "Lot 2");
  editor.setShape(lot2.id, square(124.2, 8.2, 1));
  editor.setShape("new-1", square(124.3, 8.3, 1));
  assert.deepEqual(
    farm.getState().lots.map((l) => l.name),
    ["Lot 2", "Lot 1"],
  );
  assert.equal(editor.addPlaceholder().name, "Lot 3");
  assert.equal(rows().length, 3);
});

test("Undo reverts each change in order, back to the empty Lot 1", () => {
  const { farm, editor, rows } = setup();
  editor.ensureStarted();
  const id = editor.setShape("new-1", square(124.2, 8.2, 1));
  editor.setShape(id, square(124.2, 8.2, 2)); // corner drag
  editor.rename(id, "Riverside");
  assert.equal(farm.getState().lots[0].name, "Riverside");

  assert.equal(editor.undo(), true);
  assert.equal(farm.getState().lots[0].name, "Lot 1");
  assert.equal(editor.undo(), true);
  assert.equal(farm.getState().lots[0].area_ha, 1);
  assert.equal(editor.undo(), true);
  assert.equal(farm.getState().lots.length, 0);
  assert.deepEqual(
    rows().map((r) => [r.id, r.name]),
    [["new-1", "Lot 1"]],
  );
  assert.equal(editor.undo(), false);
});

test("Undo of a delete brings the lot back with its crops and travel; older steps follow it", () => {
  const { farm, editor, removed } = setup();
  editor.ensureStarted();
  const id = editor.setShape("new-1", square(124.2, 8.2, 1));
  editor.setShape(id, square(124.2, 8.2, 3));
  farm.getState().setCrops(id, [{ crop_id: "corn", seasons: [] }]);
  const travel: Travel = { destination_id: "dest-1", distance_km: null, minutes: 40, source: "farmer", route_profile: null };
  farm.getState().setTravel(id, travel);

  editor.remove(id);
  assert.equal(farm.getState().lots.length, 0);
  assert.deepEqual(removed, ["lotdata:lot-1"]);

  editor.undo();
  const back = farm.getState().lots[0];
  assert.equal(back.name, "Lot 1");
  assert.equal(back.area_ha, 3);
  assert.deepEqual(back.crops, [{ crop_id: "corn", seasons: [] }]);
  assert.deepEqual(back.travel, [travel]);
  assert.equal(back.data_status, "pending");

  // The reshape before the delete is undone on the lot's new id.
  editor.undo();
  assert.equal(farm.getState().lots[0].area_ha, 1);
});

test("placeholders: rename, remove and Undo stay on the screen and never reach the farm store", () => {
  const { farm, editor, rows } = setup();
  editor.ensureStarted();
  const p = editor.addPlaceholder();
  editor.rename(p.id, "  Hillside ");
  editor.rename(p.id, "   "); // ignored
  assert.equal(rows()[1].name, "Hillside");
  editor.remove("new-1");
  assert.deepEqual(
    rows().map((r) => r.name),
    ["Hillside"],
  );
  editor.undo();
  assert.deepEqual(
    rows().map((r) => r.name),
    ["Lot 1", "Hillside"],
  );
  editor.undo();
  assert.equal(rows()[1].name, "Lot 2");
  assert.equal(farm.getState().lots.length, 0);
});

test("saving an unchanged outline (a tapped lot) adds no Undo step", () => {
  const { farm, editor } = setup();
  editor.ensureStarted();
  const id = editor.setShape("new-1", square(124.2, 8.2, 1));
  editor.rename(id, "Hill lot");
  editor.setShape(id, square(124.2, 8.2, 1));
  editor.undo();
  assert.equal(farm.getState().lots[0].name, "Lot 1");
});

test("+ Add lot starts one new lot, reuses it if the farmer left without drawing, and adds no Undo step", () => {
  const { farm, editor, rows } = setup();
  farm.getState().addLot(square(124.2, 8.2, 1));
  const first = editor.startNewLot();
  assert.deepEqual([first.id, first.name], ["new-2", "Lot 2"]);
  assert.equal(editor.startNewLot().id, "new-2"); // back again: the same Lot 2, not Lot 3
  assert.equal(editor.undo(), false);
  const id = editor.setShape(first.id, square(124.3, 8.3, 2));
  assert.deepEqual(
    rows().map((r) => r.name),
    ["Lot 1", "Lot 2"],
  );
  assert.equal(editor.startNewLot().name, "Lot 3");
  // Undo of the drawing brings back the Lot 2 placeholder; it is not lost.
  editor.undo();
  assert.equal(farm.getState().lots.some((l) => l.id === id), false);
  assert.equal(
    rows().filter((r) => r.area_ha === null).map((r) => r.name).join(),
    "Lot 2,Lot 3",
  );
});

test("clearHistory: Undo covers only the changes made since the screen opened", () => {
  const { farm, editor } = setup();
  editor.ensureStarted();
  const id = editor.setShape("new-1", square(124.2, 8.2, 1));
  editor.rename(id, "Hill lot");
  editor.clearHistory();
  assert.equal(editor.undo(), false);
  assert.equal(farm.getState().lots[0].name, "Hill lot");
});

test("a pin lot is a zero-area ring at the pin with the typed area", () => {
  const { farm, editor, rows } = setup();
  editor.ensureStarted();
  editor.setShape("new-1", pinShape([124.25, 8.22], 1.5));
  const lot = farm.getState().lots[0];
  assert.equal(isPinLot(lot), true);
  assert.deepEqual(lot.centroid, [124.25, 8.22]);
  assert.equal(lot.geometry.coordinates[0].length, 4);
  assert.equal(areaLabel(rows()[0]), "1.5 ha (your number)");
  assert.equal(isPinLot(square(124.2, 8.2, 1)), false);
});

test("area labels and typed hectares", () => {
  assert.equal(areaLabel({ id: "a", name: "A", area_ha: null, pin: false }), "Not drawn yet");
  assert.equal(areaLabel({ id: "a", name: "A", area_ha: 2.345, pin: false }), "2.35 ha");
  assert.equal(parseHectares("1,5"), 1.5);
  assert.equal(parseHectares(" 2 "), 2);
  assert.equal(parseHectares("0"), null);
  assert.equal(parseHectares("abc"), null);
});
