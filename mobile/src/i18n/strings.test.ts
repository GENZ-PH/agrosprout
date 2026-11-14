/// <reference types="node" />
// The three languages must stay in step: same keys, same placeholders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bareText, monthsText } from "../components/field-year-core";
import { fitReasonText, verdictText } from "../components/plan-text";
import { cropLabel, LANGS, monthNames, STRINGS, type StringKey, translate, translator } from "./strings";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("every language has every string, and none is empty", () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), keys, lang);
    for (const k of keys) assert.ok(STRINGS[lang][k as StringKey].trim().length > 0 || k === "", `${lang} ${k}`);
  }
});

test("every translation keeps the placeholders of the English string", () => {
  for (const lang of LANGS) {
    for (const k of Object.keys(STRINGS.en) as StringKey[]) {
      assert.deepEqual(placeholders(STRINGS[lang][k]), placeholders(STRINGS.en[k]), `${lang} ${k}`);
    }
  }
});

test("no string uses an em dash", () => {
  for (const lang of LANGS) for (const v of Object.values(STRINGS[lang])) assert.ok(!v.includes("—"));
});

test("translate fills placeholders and leaves unknown ones visible", () => {
  assert.equal(translate("en", "plan.label", { key: "B" }), "Plan B");
  assert.equal(translate("fil", "plan.label", { key: "B" }), "Plano B");
  assert.equal(translate("en", "plan.label"), "Plan {key}");
});

test("month names have twelve entries in every language", () => {
  for (const lang of LANGS) assert.equal(monthNames(lang).length, 12);
  assert.equal(monthNames("ceb")[0], "Ene");
});

test("crop names follow the language and fall back to English, then the id", () => {
  const rice = { name: "Lowland rice (irrigated or rainfed paddy)", local_name: "Humay" };
  assert.equal(cropLabel("en", rice, "lowland-rice"), "Lowland rice");
  assert.equal(cropLabel("fil", rice, "lowland-rice"), "Palay");
  assert.equal(cropLabel("ceb", rice, "lowland-rice"), "Humay");
  assert.equal(cropLabel("ceb", { name: "Soybean", local_name: "Soybeans (utaw)" }, "soybean"), "Soybeans");
  assert.equal(cropLabel("fil", { name: "Sesbania rostrata (green manure)", local_name: null }, "sesbania-rostrata"), "Sesbania rostrata");
  assert.equal(cropLabel("ceb", undefined, "mystery"), "mystery");
});

test("the wording helpers speak the chosen language", () => {
  const t = translator("ceb");
  const months = monthNames("ceb");
  assert.equal(monthsText([10, 4, 5], t, months), "Abr hangtod May ug Okt");
  assert.equal(bareText({ bare_days: 48, bare_months: [] }, t, months), "Bakante ang uma sulod sa 48 ka adlaw");
  assert.equal(fitReasonText({ code: "waterlogging", months: [7, 8] }, translator("fil"), monthNames("fil")), "Sobrang basa ang lupa sa Hul at Ago, at ayaw ng pananim na ito na nakababad sa tubig.");
  assert.equal(
    verdictText({ chosen: ["water"], bestKey: "D", bestName: "Balanse", bestTotal: 89, baselineTotal: 72, bestIsBaseline: false }, translator("fil")),
    "Kapag inuna ang Makatipid sa tubig, ang plano D (Balanse) ang pinakabagay: 89 sa 100, mas mataas nang 17 kaysa sa mga pananim mo ngayon.",
  );
});
