import type { Farm, Lot, LonLat } from "../types";

// The bundled demo farm (#36): two lots at the provisional demo point (pipeline/demo_farms.json,
// 8.0 N, 123.8 E), read from assets/data/demo/lanao-norte-demo-1.json, so results show with no
// signal and no drawing. The persona is fictional (docs/05). Both lots sit in the same NASA
// POWER cell, so they share climate numbers and differ by land type, water and crops. The
// crops are everyday ones in the Philippines: rice (humay) on the paddy, corn (mais) and peanut
// (mani) on the upland lot.

export const DEMO_REF = "demo/lanao-norte-demo-1";

/** A square lot of `sideM` metres with its south-west corner at `sw`. */
function square(sw: LonLat, sideM: number): Pick<Lot, "geometry" | "centroid" | "area_ha"> {
  const dLat = sideM / 110_574; // metres per degree of latitude
  const dLon = sideM / (111_320 * Math.cos((sw[1] * Math.PI) / 180));
  const [x, y] = sw;
  // 7 decimals (about 1 cm): the map page (Terra Draw) rejects coordinates with more decimals
  // than its precision, and then the sample lots were neither drawn nor zoomed to.
  const r = (v: number) => Math.round(v * 1e7) / 1e7;
  return {
    geometry: { type: "Polygon", coordinates: [[[r(x), r(y)], [r(x + dLon), r(y)], [r(x + dLon), r(y + dLat)], [r(x), r(y + dLat)], [r(x), r(y)]]] },
    centroid: [r(x + dLon / 2), r(y + dLat / 2)],
    area_ha: Math.round((sideM * sideM) / 100) / 100,
  };
}

export const DEMO_FARM: Farm = {
  version: 1,
  destinations: [],
  priorities: { water: 50, soil: 50, income: 50, labor: 50 },
  lots: [
    {
      id: "lot-1",
      name: "Paddy lot",
      ...square([123.8, 8.0], 100),
      details: { land_type: "lowland", water: "rain", soil: "clayey" },
      crops: [{ crop_id: "lowland-rice", seasons: [] }],
      data_status: "ready",
      data_ref: DEMO_REF,
      travel: [],
    },
    {
      id: "lot-2",
      name: "Upland lot",
      ...square([123.802, 8.001], 70),
      details: { land_type: "sloping", water: "rain", soil: "loamy" },
      crops: [{ crop_id: "corn", seasons: [] }, { crop_id: "peanut", seasons: [] }],
      data_status: "ready",
      data_ref: DEMO_REF,
      travel: [],
    },
  ],
};

/** True when the saved farm is the demo farm (every lot reads the bundled demo data). */
export const isDemoFarm = (lots: readonly Pick<Lot, "data_ref">[]) => lots.length > 0 && lots.every((l) => l.data_ref === DEMO_REF);
