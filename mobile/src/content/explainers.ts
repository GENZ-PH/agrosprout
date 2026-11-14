import type { SourceKey } from "./sources";
// Plain-language texts for the app (#31): the ⓘ explainer behind every card, the Learn
// glossary, the Data & limits page and the standing disclaimer.
//
// Rules (CLAUDE.md): English; say "SI", never the other word; no number without a source
// (numbers here are the ones in docs/03, docs/07 or the cited papers; the period of a lot's
// data is the `{period}` token, filled in with `fill()` from the lot's own data); the app
// supports, and does not replace, the farmer and the agricultural technician.
//
// This is a first draft of the wording. Data and Engine leads check the facts; the Story
// lead edits the voice.

import { COMPONENT_LABELS } from "../engine/explain";

export type ExplainerId =
  | "lot-snapshot"
  | "soil-moisture"
  | "your-crops"
  | "harvest-out"
  | "recommendations"
  | "priorities"
  | "months-compare"
  | "season-calendar"
  | "year-calendar"
  | "what-if"
  | "farm-map"
  | "lot-cutout"
  | "satellite-checks"
  | "top-crops";

export interface Explainer {
  id: ExplainerId;
  /** Card title the ⓘ belongs to. */
  title: string;
  /** What the data is. */
  what: string;
  /** Where it comes from. */
  source: string;
  /** The datasets and methods behind the card, as source chips (sources.ts). */
  sources: readonly SourceKey[];
  /** How to read it. */
  read: string;
  /** Its limits, one short sentence each. */
  limits: string[];
}

export const DISCLAIMER =
  "This app supports your decisions. It does not replace your own judgment or your local agricultural technician. The numbers are estimates from satellite and weather-model data, not a forecast. Please check the results with someone who knows your field.";

export const EXPLAINERS: Readonly<Record<ExplainerId, Explainer>> = {
  "lot-snapshot": {
    id: "lot-snapshot",
    sources: ["power", "fao56", "brouwer"],
    title: "Lot snapshot",
    what: "The average rain and the water that crops and the air would use up, month by month, for your lot. Bars show rain next to the crop water need. Dry and wet months are marked.",
    source:
      "NASA POWER. Rain, temperature, humidity and wind come from NASA's MERRA-2 weather model, and sunshine from NASA's CERES satellite data. Years used: {period}. Evaporation (ET₀) is worked out on your phone from those NASA values with the FAO-56 Penman-Monteith method (Allen and others, 1998).",
    read: "Where the rain bar is shorter than the water-need bar, crops would need extra water that month. A dry year and a wet year are shown too: they are the 20th and the 80th percentile of the years used, so most years fall between them.",
    limits: [
      "The numbers describe a NASA grid cell, roughly 50 km across, not your exact field. The weather model's cell is 0.5° × 0.625°, and the sunshine data is coarser still (1° × 1°).",
      "Nearby lots in the same grid cell share the same climate numbers.",
      "Values are monthly, so a short dry spell inside a month is smoothed out.",
      "If your field's elevation is not known, evaporation is calculated at sea level.",
    ],
  },
  "soil-moisture": {
    id: "soil-moisture",
    sources: ["power"],
    title: "Soil moisture",
    what: "How wet the soil is around the roots, month by month, from 0 (dry) to 1 (saturated). Months of dry stress for crops are marked.",
    source: "NASA POWER root-zone soil wetness (GWETROOT), a model estimate. Years used: {period}.",
    read: "A low number means the root zone is usually dry in that month; a very high number means it is usually soaked, which some crops do not tolerate.",
    limits: [
      "It is a model estimate for a large grid cell, not a measurement in your field.",
      "A simple hand test in your own field is more reliable for your soil: dig down and squeeze a handful of soil.",
    ],
  },
  "your-crops": {
    id: "your-crops",
    sources: ["power", "fao56", "ecocrop", "crop-library"],
    title: "Your crops here",
    what: "For each crop you chose, whether this lot suits it: Good fit, Watch out or Poor fit, with the one or two main reasons (water, heat, waterlogging and, once you add places, the distance to market).",
    source:
      "Crop water use from FAO-56 (Allen and others, 1998), temperature ranges from the FAO Ecocrop database, and rain and temperature from NASA POWER. Each crop value is cited in the crop library (crops.json).",
    read: "The fit is mainly about water: how much of the crop's water need the rain would not cover in a typical year, and in a dry year. Heat, cold and waterlogging can lower it too. When you have not given your months, a typical local planting calendar is used and labelled assumed.",
    limits: [
      "Crop values are general, not specific to a variety.",
      "The cut-offs between Good fit, Watch out and Poor fit are team assumptions that still need a local check.",
      "Irrigation counts only as far as you told us: with \"some\" irrigation we assume it covers half of the rain shortage (an assumption), with full irrigation all of it, and if the water source is unknown we assume rain only.",
    ],
  },
  "farm-map": {
    id: "farm-map",
    sources: ["power", "fao56", "ecocrop", "crop-library", "farmer"],
    title: "Your lots on the map",
    what: "Each lot you drew, colored by how well it suits the crops you grow there. A lot shows the result of its weakest crop, the same Good fit, Watch out or Poor fit as in \"Your crops here\". The label on each lot gives its name, its area and the result in words.",
    source:
      "The same check as \"Your crops here\": crop water use from FAO-56 (Allen and others, 1998), temperature ranges from the FAO Ecocrop database, and rain and temperature from NASA POWER at the middle of each lot. Years used: {period}. The area is worked out from the outline you drew.",
    read: "Green is a good fit, orange means watch out, red is a poor fit, and dark gray means there is not enough data to judge. Light gray lots have no result yet: pick their crops, or wait for the NASA data to download. Tap a lot to see its results below.",
    limits: [
      "The numbers describe a NASA grid cell, roughly 50 km across, not your exact field, so lots close together will often share a color.",
      "The cut-offs between Good fit, Watch out and Poor fit are team assumptions that still need a local check.",
      "Without signal the photo under your lots may not load; the lots and their colors still show.",
    ],
  },
  "top-crops": {
    id: "top-crops",
    title: "Top 3 for this lot",
    sources: ["power", "fao56", "ecocrop", "crop-library", "farmer"],
    what: "The 3 crops from our crop list that suit this lot best, and the planting months when each one does best. Tap one to choose it as the lot's crop, or search for any other crop you grow.",
    source:
      "Rain, temperature and soil wetness from NASA POWER at this lot ({period}). Crop water use from FAO-56 (Allen and others, 1998) and temperature ranges from the FAO Ecocrop database, each cited in the crop library (crops.json). It is the same check as \"Your crops here\", and your answer about the lot's water is used. Crop names in the search: FAO Ecocrop © FAO, via OpenCLIM/ecocrop.",
    read: "Each crop is tried as one season planted in each month of the year. Crops that are a Good fit in some month come first, then Watch out, then Poor fit. Among crops with the same result, the one with more planting months at that result comes first. \"If planted in\" gives those months. A Watch out or Poor fit crop also says its main problem.",
    limits: [
      "The order among equally good crops is a team assumption: a crop with more good planting months ranks higher.",
      "Each crop is checked as one season on its own.",
      "\"Your crops here\" on your results checks your own months, or the usual months if you gave none, so it can say something different.",
      "Climate is for a coarse grid cell, not your field alone.",
      "Soil type and elevation are not part of this check.",
      "Crops found only by search are not scored.",
      "Please check with your agricultural technician before you change crops.",
    ],
  },
  "lot-cutout": {
    id: "lot-cutout",
    sources: ["power", "fao56", "ecocrop", "crop-library", "farmer"],
    title: "Now vs best option",
    what: "The shape of the lot you drew, shown twice: on the left with your crops now, on the right with the best other option for this lot (the one with the highest total score). Each shape is filled with one color for the kind of data you pick: Soil health, Crop fit, Root-zone wetness or Rain in a dry year. The number or words on the shape is its value.",
    source:
      "Soil health is the 3-year Soil Health Index from this app's rotation model. Crop fit is the same check as \"Your crops here\" (FAO-56 crop water use, FAO Ecocrop temperature ranges). Root-zone wetness is NASA POWER GWETROOT (0 dry, 1 saturated) and rain is NASA POWER PRECTOTCORR in a dry year (the 20th percentile), both over the months a crop is in the field. Years used: {period}.",
    read: "Compare the two shapes. Soil health: green goes up from the start, gray stays level, orange goes down. Crop fit: the same colors as \"Your crops here\". Wetness and rain: darker blue means wetter, or more of the year's rain falling while a crop is in the field. Gray with \"No data\" means a value is missing.",
    limits: [
      "One color per lot: the data has one value for the whole lot, so nothing here shows differences inside your field.",
      "Soil health is a relative indicator from this model, not a soil test. It does not show carbon or nitrogen.",
      "Wetness and rain describe a NASA grid cell roughly 50 km across, so they change only when the crop months change.",
      "This supports your decision. Check it with your agricultural technician.",
    ],
  },
  "harvest-out": {
    id: "harvest-out",
    sources: ["osm", "crop-library", "farmer"],
    title: "Getting your harvest out",
    what: "How long it takes to bring the harvest from each lot to the places where you sell or store it, and which crops suit that trip.",
    source:
      "Your own travel time if you entered it. Otherwise a road route from OpenStreetMap data (© OpenStreetMap contributors) divided by a mode speed, and if you are offline a rough straight-line estimate. The card always says which one was used.",
    read: "Crops that spoil within days need a short trip; crops that keep for weeks or months, such as dried grain, can travel further. A time marked rough estimate should be confirmed by you.",
    limits: [
      "Travel speeds and the load per trip are assumptions, not measurements, and your own numbers always win.",
      "Transport cost is not calculated unless you enter a fare.",
      "Roads that are muddy or closed in the rainy season are not known to the road route.",
    ],
  },
  recommendations: {
    id: "recommendations",
    sources: ["power", "fao56", "brouwer", "ecocrop", "crop-library"],
    title: "Recommendations",
    what: "Several ways to use your lot over the year: your own crops, and options that add or swap crops. Each option says why it was suggested, what evidence it rests on, what it improves, what is not known and what to check locally.",
    source:
      "The scores combine the water balance (FAO-56 crop water use and effective rain, Brouwer and Heibloem, 1986), the crop's temperature range, and crop traits from the crop library. Your options are compared with your own crops.",
    read: `Each option gets a score from 0 to 100 on: ${Object.values(COMPONENT_LABELS).join("; ")}. The badge (High, Medium or Low) shows how sure we are: it drops when the order of the options changes between a dry and a wet year, and to Low when two or more of your answers are "I don't know".`,
    limits: [
      "It is a comparison tool, not a promise of yield or income.",
      "Prices and labor are rough, because no local price data is used.",
      "The soil-health score is a relative indicator from the model, not a soil test.",
      "Please confirm the suggestions with your agricultural technician before changing crops.",
    ],
  },
  priorities: {
    id: "priorities",
    sources: ["farmer"],
    title: "What matters to you",
    what: "Four choices: save water, build soil, extra income and less work. Tapping them re-ranks the options straight away, on your phone.",
    source: "Your own answers. The choices only change how much each score counts; they do not change the data.",
    read: "All four start equal. Tap the ones that matter most to you: they count twice as much as the others. See which option moves to the top, and tap again to undo.",
    limits: ["A priority can only count when the data behind it exists; for example income and market access need crop and destination information."],
  },
  "months-compare": {
    id: "months-compare",
    sources: ["power", "fao56", "ecocrop", "crop-library", "farmer"],
    title: "Your months vs better months",
    what: "For each crop and season, your planting months next to the best nearby months we found, with the same crop and season length.",
    source: "The same water balance and temperature checks as the recommendations, run for each of the 12 possible planting months, using NASA POWER data for {period}.",
    read: "A better month is shown only when it clearly beats yours and does not clash with your other crops on the same lot. If a clearly better month would clash with another crop of yours, the card says so and names that crop: it is a trade-off to weigh with your technician, not a move to make. Only when nothing beats your month, even on a lot with nothing else on it, does the card say your timing is already good.",
    limits: [
      "It cannot see things we have no data for, such as when seed or labor are available.",
      "The confidence is lower if the best month changes between a dry and a typical year.",
      "Check the suggested months with your agricultural technician and your own experience of the field.",
    ],
  },
  "season-calendar": {
    id: "season-calendar",
    sources: ["power", "crop-library", "farmer"],
    title: "Whole-lot calendar",
    what: "Your calendar next to a better-timed calendar and alternative rotations, across the whole year for one lot.",
    source: "Your own months, the options from the recommendations and the planting-month scan.",
    read: "Bars that overlap mean crops grown together on the same lot. Empty months mean bare soil, which can wash away in heavy rain.",
    limits: ["Only crops you chose are shown; other possible crops appear as alternatives, not as advice."],
  },
  "year-calendar": {
    id: "year-calendar",
    sources: ["power", "fao56", "ecocrop", "crop-library"],
    title: "Your year on your lot",
    what: "Each month of the year for the plan you pick: when to plant, when to harvest, and the months a crop may be short of water, too hot or too wet.",
    source:
      "The plan comes from the recommendations for this lot. Short of water, too hot and too wet are worked out from NASA POWER data for {period} with the FAO-56 water balance and each crop's temperature range.",
    read: "Tap a month to see what happens in it. A sun marks a month when a crop in the field may be short of water, the thermometer a month that may be too hot, a drop a month that may be too wet. Pick another plan below the calendar to see its year instead.",
    limits: [
      "The months are from monthly averages, so a short dry or hot spell inside a month is not shown.",
      "A risk is shown only for months when a crop is in the field.",
      "It supports your own judgment and your agricultural technician; it does not replace them.",
    ],
  },
  "what-if": {
    id: "what-if",
    sources: ["power", "fao56"],
    title: "What if it is drier or warmer?",
    what: "The same results recalculated for a change in rainfall and temperature that you pick with the sliders.",
    source: "Your lot's NASA POWER data with the rainfall and temperature changed as set; evaporation is recalculated for the warmer temperature.",
    read: "It shows how the options hold up under a drier, wetter or warmer climate.",
    limits: [
      "It is a what-if, not a forecast.",
      "Humidity, wind, sunshine and soil wetness are kept at today's values.",
    ],
  },
  "satellite-checks": {
    id: "satellite-checks",
    title: "Satellite checks",
    what: "NASA satellite data for the sample farm next to the NASA POWER numbers the results use: rain from GPM IMERG and soil moisture from SMAP.",
    source:
      "GPM IMERG Final V07 monthly rain (0.1°, GES DISC) and SMAP L4 soil moisture (SPL4SMGP v8, 9 km, NSIDC). Fetched once by the team's pipeline and bundled with the app; NASA POWER for {period}.",
    sources: ["imerg", "smap", "power-daily"],
    read: "Look at the shape over the year: do the wet and dry months line up? The sizes differ because each product covers a different area and measures a different thing. Tap a source name to see how each number is worked out.",
    limits: [
      "These are checks, not inputs: the scores do not use them.",
      "Only the sample farm has them, because they are fetched ahead of time, not on the phone.",
      "SMAP covers 2015 onward, and IMERG monthly files end at 2025-09.",
      "A satellite grid cell is larger than the lot, and the sample farm's location is provisional.",
    ],
  },
};

export interface GlossaryTerm {
  term: string;
  /** Plain definition, one or two sentences. */
  meaning: string;
  /** Where the definition or method comes from, when it is a specific method. */
  source?: string;
}

export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: "Evaporation (ET₀)",
    meaning: "How much water a well-watered short green crop would lose to the air each day, from the sun, temperature, humidity and wind. It is the starting point for how much water crops need.",
    source: "FAO-56, Allen and others, 1998",
  },
  {
    term: "Crop coefficient (Kc)",
    meaning: "A number that scales evaporation to a particular crop at a particular growth stage. Young crops use less water than crops at full growth.",
    source: "FAO-56, Allen and others, 1998",
  },
  {
    term: "Crop water need",
    meaning: "The water a crop uses over its season: evaporation multiplied by the crop coefficient. For paddy rice, water lost by seeping down and the water to prepare the field are added.",
    source: "FAO-56, Allen and others, 1998; Brouwer and Heibloem, 1986",
  },
  {
    term: "Effective rain",
    meaning: "The part of the rain that stays in the soil where roots can use it. The rest runs off, evaporates or drains below the roots.",
    source: "Brouwer and Heibloem, 1986, FAO Irrigation Water Management Training Manual No. 3",
  },
  {
    term: "Root-zone wetness",
    meaning: "How wet the soil is around the roots, from 0 (dry) to 1 (saturated).",
    source: "NASA POWER (GWETROOT)",
  },
  {
    term: "Water stress index",
    meaning: "The share of a crop's water need that rain (and irrigation, if any) does not cover. 0 means no shortage; 1 means none of the need is met.",
  },
  {
    term: "Typical, dry and wet year",
    meaning: "From the years of data, the middle year is the typical year. The dry year is the 20th percentile (one in five years is drier) and the wet year is the 80th percentile (one in five years is wetter).",
  },
  {
    term: "Grid cell",
    meaning: "The patch of the Earth that one NASA number describes: 0.5° × 0.625° for rain, temperature, humidity, wind and soil wetness, and 1° × 1° for sunshine. Lots inside the same cell get the same climate numbers.",
    source: "NASA POWER",
  },
  {
    term: "Rotation",
    meaning: "The order in which crops are grown on a lot, over a season or over the year.",
  },
  {
    term: "Intercrop",
    meaning: "Growing two crops on the same lot at the same time.",
  },
  {
    term: "Legume",
    meaning: "A crop such as mungbean or peanut that works with bacteria in its roots to add nitrogen to the soil. It can help the crop that follows.",
  },
  {
    term: "Bare soil",
    meaning: "Months when nothing is growing on the lot. Bare soil dries out and can wash away in heavy rain, especially on a slope.",
  },
  {
    term: "Perishable",
    meaning: "A crop that spoils quickly after harvest, within days. Other crops, such as dried grain, keep for weeks or months.",
  },
  {
    term: "Road route and rough estimate",
    meaning: "A road route is the distance along roads from map data. A rough estimate is the straight-line distance made longer by a winding-road factor. You can always replace either with your own time.",
  },
  {
    term: "Assumption",
    meaning: "A value the team chose because no measured value was available. It is labelled as an assumption and can be replaced with your own number.",
  },
  {
    term: "Confidence",
    meaning: "How sure we are about an option: High, Medium or Low. It drops when the ranking changes between a dry and a wet year, and to Low when two or more of your answers are \"I don't know\".",
  },
  {
    term: "SI",
    meaning: "Super Intelligence, the term used in this project for the software tools that helped build it.",
  },
];

export interface DataSource {
  name: string;
  /** What the app uses it for. */
  used_for: string;
  /** Period, or `{period}` for the years of a lot's own data. */
  period: string;
  /** Resolution or coverage. */
  resolution: string;
  url?: string;
}

export const DATA_SOURCES: readonly DataSource[] = [
  {
    name: "NASA POWER (monthly point data)",
    used_for: "Rainfall, temperature, humidity, wind, sunshine and root-zone soil wetness for each lot.",
    period: "{period}",
    resolution: "Monthly values. Rain, temperature, humidity, wind and soil wetness (MERRA-2): 0.5° × 0.625° grid. Sunshine (CERES SYN1deg): 1° × 1° grid.",
    url: "https://power.larc.nasa.gov/",
  },
  {
    name: "FAO Irrigation and Drainage Paper 56 (Allen and others, 1998)",
    used_for: "Evaporation (Penman-Monteith), crop coefficients and growth stages.",
    period: "Published 1998",
    resolution: "Method and tables, not map data",
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  {
    name: "FAO Irrigation Water Management Training Manual No. 3 (Brouwer and Heibloem, 1986)",
    used_for: "Effective rain and the extra water that paddy rice needs.",
    period: "Published 1986",
    resolution: "Method and tables, not map data",
    url: "https://www.fao.org/4/s2022e/s2022e08.htm",
  },
  {
    name: "FAO Ecocrop database",
    used_for:
      "The temperature range each crop tolerates, and the crop names you can search for when you pick crops. Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop.",
    period: "Database values",
    resolution: "Per crop, not per place",
    url: "https://github.com/OpenCLIM/ecocrop",
  },
  {
    name: "Crop library (crops.json)",
    used_for: "Season length, planting calendars, waterlogging and drought tolerance and other crop traits. Each value has its own citation in the file.",
    period: "See each citation",
    resolution: "Per crop",
  },
  {
    name: "OpenStreetMap routing (FOSSGIS server)",
    used_for: "Road distance from your lot to a harvest place, when you are online.",
    period: "Current road map",
    resolution: "Points rounded to about 100 m before they are sent",
    url: "https://routing.openstreetmap.de/",
  },
  {
    name: "PSA OpenSTAT",
    used_for: "Typical yield per hectare for each crop with a PSA figure (palay, corn, mungbean, peanut, soybean, string bean, sweet potato, eggplant), used to estimate how many trips a harvest needs. Cited per crop in crops.json.",
    period: "2022-2024",
    resolution: "Lanao del Norte, yearly (soybean: Northern Mindanao)",
    url: "https://openstat.psa.gov.ph/",
  },
  {
    name: "NOAA Climate Prediction Center, Oceanic Niño Index",
    used_for: "This season's El Niño context, shown on the dashboard next to the PAGASA advisory. Not used in any score.",
    period: "Latest season in the file (ASO 2026)",
    resolution: "Ocean-wide, three-month averages",
    url: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
  },
  {
    name: "DOST-PAGASA El Niño advisory",
    used_for: "This season's El Niño context, shown on the dashboard. Not used in any score.",
    period: "Issued 2026-11-04",
    resolution: "Whole country",
    url: "https://pagasa.dost.gov.ph/press-release/233",
  },
];

/**
 * NASA datasets the challenge names and how this app treats them (#112, Part 4). Checked against the
 * code on main, not against plans: say "not used" until a dataset really drives a result.
 */
export interface DatasetStatus {
  name: string;
  status: "Used" | "Demo farm only" | "Not used";
  note: string;
}

export const CHALLENGE_DATASETS: readonly DatasetStatus[] = [
  { name: "NASA POWER", status: "Used", note: "Drives every result for every lot you draw." },
  {
    name: "SRTM (elevation and slope)",
    status: "Demo farm only",
    note: "The demo farm file has elevation and slope from SRTM. Lots you draw do not use it yet, so their evaporation is calculated at sea level and their erosion check relies on the land type you give.",
  },
  { name: "SMAP (soil moisture)", status: "Demo farm only", note: "SMAP L4 (SPL4SMGP v8, 9 km, 2015-2025) is shown for the sample farm in Satellite checks, as a check. The scores use NASA POWER soil wetness." },
  { name: "GPM IMERG (rainfall)", status: "Demo farm only", note: "IMERG Final V07 monthly rain (0.1°, 2001 to 2025-09) is shown for the sample farm beside NASA POWER rain in Satellite checks. The scores use NASA POWER rain." },
  { name: "MODIS, Landsat (vegetation)", status: "Not used", note: "Vegetation stress is not measured." },
  { name: "ECOSTRESS (evaporation)", status: "Not used", note: "Not in the app yet. Evaporation is worked out from NASA POWER with the FAO-56 method." },
  { name: "GRACE and GRACE-FO (water storage)", status: "Not used", note: "They measure water stored over large regions, far coarser than a farm lot." },
  { name: "GEDI (forest structure)", status: "Not used", note: "It measures the height and structure of forests and other vegetation, not field crops." },
];

/** Known limitations to state openly (docs/07 §8), plus the ones found while building. */
export const LIMITATIONS: readonly string[] = [
  "Climate is for a coarse grid cell, not field scale. There is no field-scale water model.",
  "Everything is monthly, so short dry spells inside a month are smoothed out.",
  "Crop values are general and not specific to a variety.",
  "Market and labor information is rough and needs local prices.",
  "The soil-health score is a relative indicator from the model, not a lab test.",
  "Temperatures for lots you draw are estimated from the monthly mean and daily range, and if your field's elevation is not known evaporation is calculated at sea level.",
  "Crop water use is not adjusted for a humid, low-wind climate, so it may be slightly too high in such places.",
  "Travel speeds, loads per trip and wet-road effects are assumptions, and transport cost is not calculated unless you enter a fare.",
  // D31 (#107): ground area = map area x sqrt(1 + (slope % / 100)^2), so 20% -> +2.0%, 30% -> +4.4%.
  "Lot area is measured flat, as on a map. On sloping land the ground itself is a little larger: about 2% more on a 20% slope and about 4% more on a 30% slope.",
  "Results are for comparing options, not for predicting yield or income.",
  "The results come from statistics and rules (a water balance and scores worked out on your phone), not from a trained SI model. SI tools helped to build the app.",
  "Frost is not modelled. The app checks each crop's lower temperature limit instead.",
  "Forage value and the equipment you have are not part of the scores, and water soaking into the soil is not modelled separately: ground cover and erosion stand in for it.",
  "Soil comes only from what you tell us (soil feel and land type). The app does not use a soil map.",
];

/** Fill `{name}` tokens, e.g. `fill(text, { period: "2001-2025" })`. Unknown tokens are left as they are. */
export function fill(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
