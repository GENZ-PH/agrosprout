// Month names and sentences the app builds from parts (2026-11-15). Keys with {x} are patterns:
// "Plant {crop}." also matches "Plant Corn." and the crop part is looked up on its own.
// Written with SI (Claude); to be checked by a team member who speaks each language.
type Dict = Record<string, string>;

const EN_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const zip = (en: string[], to: string[]): Dict => Object.fromEntries(en.map((e, i) => [e, to[i]]));

export const TL_EXTRA: Dict = {
  ...zip(EN_LONG, ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"]),
  ...zip(EN_SHORT, ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"]),
  "and": "at",
  "Lot {n}": "Lote {n}",
  "Plant {crop}.": "Magtanim ng {crop}.",
  "Harvest {crop}.": "Anihin ang {crop}.",
  "{crop} in the field.": "Nasa bukid ang {crop}.",
  "{crop} in the field": "Nasa bukid ang {crop}",
  "Compare {lot} with the best option": "Ihambing ang {lot} sa pinakamagandang opsyon",
  "{a} out of 100 with this plan, {b} with your crops now": "{a} sa 100 sa planong ito, {b} sa iyong mga pananim ngayon",
  "{month} {year}, this month": "{month} {year}, ngayong buwan",
  "{month} {year} (this month)": "{month} {year} (ngayong buwan)",
  "Your crops score {n} out of 100, the highest on this lot.": "May iskor na {n} sa 100 ang iyong mga pananim, ang pinakamataas sa loteng ito.",
  "Planting in {month}. Now tap the harvest month.": "Pagtatanim sa {month}. Ngayon, i-tap ang buwan ng anihan.",
  "Season {a} of {b}": "Panahon {a} ng {b}",
  "From {lot}": "Mula sa {lot}",
  "{lot}: lot comparison": "{lot}: paghahambing ng lote",
  "if planted in {months}": "kung itatanim sa {months}",
  "{n} ha (your number)": "{n} ha (iyong numero)",
  "Suggestion:": "Mungkahi:",
  "You now:": "Ikaw ngayon:",
  "STEP 1 OF 2": "HAKBANG 1 NG 2",
  "EDIT LOT": "BAGUHIN ANG LOTE",
  "NEW LOT": "BAGONG LOTE",
  "(this month)": "(ngayong buwan)",
};

export const CEB_EXTRA: Dict = {
  ...zip(EN_LONG, ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Septiyembre", "Oktubre", "Nobyembre", "Disyembre"]),
  ...zip(EN_SHORT, ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Sep", "Okt", "Nob", "Dis"]),
  "and": "ug",
  "Lot {n}": "Lote {n}",
  "Plant {crop}.": "Pagtanom og {crop}.",
  "Harvest {crop}.": "Anihon ang {crop}.",
  "{crop} in the field.": "Naa sa uma ang {crop}.",
  "{crop} in the field": "Naa sa uma ang {crop}",
  "Compare {lot} with the best option": "Itandi ang {lot} sa labing maayong kapilian",
  "{a} out of 100 with this plan, {b} with your crops now": "{a} sa 100 niining plano, {b} sa imong mga tanom karon",
  "{month} {year}, this month": "{month} {year}, karong bulana",
  "{month} {year} (this month)": "{month} {year} (karong bulana)",
  "Your crops score {n} out of 100, the highest on this lot.": "Ang imong mga tanom adunay iskor nga {n} sa 100, ang labing taas niining loteha.",
  "Planting in {month}. Now tap the harvest month.": "Pagtanom sa {month}. Karon, i-tap ang bulan sa ani.",
  "Season {a} of {b}": "Panahon {a} sa {b}",
  "From {lot}": "Gikan sa {lot}",
  "{lot}: lot comparison": "{lot}: pagtandi sa lote",
  "if planted in {months}": "kon itanom sa {months}",
  "{n} ha (your number)": "{n} ha (imong numero)",
  "Suggestion:": "Sugyot:",
  "You now:": "Ikaw karon:",
  "STEP 1 OF 2": "LAKANG 1 SA 2",
  "EDIT LOT": "USBA ANG LOTE",
  "NEW LOT": "BAG-ONG LOTE",
  "(this month)": "(karong bulana)",
};
