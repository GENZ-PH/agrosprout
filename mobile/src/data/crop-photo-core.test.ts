import assert from "node:assert/strict";
import { test } from "node:test";

import type { EcocropNames } from "../types";
import {
  fetchCropPhoto,
  imageInfoUrl,
  isAcceptableLicense,
  parseImageInfo,
  parseSummary,
  photoCreditLine,
  sciNameFor,
  summaryUrl,
} from "./crop-photo-core";

const index = {
  library: {},
  species: [
    {
      code: "1",
      sci: "Manihot esculenta",
      names: ["cassava", "manioc", "kamoteng kahoy"],
    },
    { code: "2", sci: "Ipomoea batatas", names: ["sweet potato", "camote"] },
    { code: "3", sci: "Colocasia esculenta", names: ["taro", "gabi"] },
    { code: "4", sci: "Xanthosoma sagittifolium", names: ["taro", "tannia"] },
  ],
} as unknown as EcocropNames;

test("a crop name gives a scientific name only when exactly one species has it", () => {
  assert.equal(sciNameFor("Cassava", index), "Manihot esculenta");
  assert.equal(sciNameFor("manihot  esculenta", index), "Manihot esculenta");
  assert.equal(sciNameFor("Taro", index), null, "two species share this name");
  assert.equal(sciNameFor("Jupiter", index), null);
  assert.equal(sciNameFor("", index), null);
  assert.equal(sciNameFor("Cassava", null), null);
});

// Shapes copied from real answers (2026-11-15) for Solanum melongena.
const summary = {
  type: "standard",
  title: "Eggplant",
  thumbnail: {
    source:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG",
  },
  originalimage: {
    source:
      "https://upload.wikimedia.org/wikipedia/commons/7/76/Solanum_melongena_24_08_2012_%281%29.JPG",
  },
};
const imageInfo = {
  query: {
    pages: {
      "1": {
        imageinfo: [
          {
            extmetadata: {
              LicenseShortName: { value: "CC BY-SA 3.0" },
              LicenseUrl: {
                value: "https://creativecommons.org/licenses/by-sa/3.0",
              },
              ObjectName: { value: "Solanum melongena" },
              Artist: {
                value:
                  '<a href="//commons.wikimedia.org/wiki/User:Joydeep" title="User:Joydeep">Joydeep</a>',
              },
            },
          },
        ],
      },
    },
  },
};

test("the summary gives the picture and its Commons file name", () => {
  const s = parseSummary(summary);
  assert.equal(s?.fileName, "Solanum_melongena_24_08_2012_(1).JPG");
  assert.ok(s?.thumb.includes("330px"));
});

test("a disambiguation page, a page without a picture or a picture not on Commons gives nothing", () => {
  assert.equal(parseSummary({ ...summary, type: "disambiguation" }), null);
  assert.equal(parseSummary({ type: "standard", title: "x" }), null);
  assert.equal(
    parseSummary({
      type: "standard",
      thumbnail: {
        source:
          "https://upload.wikimedia.org/wikipedia/en/thumb/a/a.png/330px-a.png",
      },
      originalimage: {
        source: "https://upload.wikimedia.org/wikipedia/en/a/a.png",
      },
    }),
    null,
  );
  assert.equal(parseSummary(null), null);
  assert.equal(parseSummary("x"), null);
});

test("the author is cleaned of HTML and the credit has a link to the file page", () => {
  const c = parseImageInfo(imageInfo, "Solanum_melongena_24_08_2012_(1).JPG");
  assert.equal(c?.author, "Joydeep");
  assert.equal(c?.license, "CC BY-SA 3.0");
  assert.equal(
    c?.page,
    "https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG",
  );
  assert.equal(
    photoCreditLine(c!),
    "Photo: Joydeep, CC BY-SA 3.0 (Wikimedia Commons)",
  );
});

test("without an object name the file name is the title", () => {
  const noName = JSON.parse(JSON.stringify(imageInfo));
  delete noName.query.pages["1"].imageinfo[0].extmetadata.ObjectName;
  assert.equal(parseImageInfo(noName, "Rice_plant.jpg")?.title, "Rice plant");
});

test("only licenses we can credit are accepted", () => {
  for (const ok of [
    "CC0",
    "Public domain",
    "CC BY 4.0",
    "CC BY-SA 3.0",
    "CC BY 3.0 US",
    "CC BY-SA 2.5",
  ])
    assert.ok(isAcceptableLicense(ok), ok);
  for (const no of [
    "CC BY-NC 4.0",
    "CC BY-ND 2.0",
    "CC BY-NC-SA 3.0",
    "GFDL",
    "All rights reserved",
    "Fair use",
    "",
  ])
    assert.ok(!isAcceptableLicense(no), no);
});

test("no author or a license we do not accept gives nothing", () => {
  const withMeta = (m: object) => ({
    query: { pages: { "1": { imageinfo: [{ extmetadata: m }] } } },
  });
  assert.equal(
    parseImageInfo(
      withMeta({
        LicenseShortName: { value: "CC BY-NC 4.0" },
        Artist: { value: "A" },
      }),
      "f.jpg",
    ),
    null,
  );
  assert.equal(
    parseImageInfo(
      withMeta({ LicenseShortName: { value: "CC BY 4.0" } }),
      "f.jpg",
    ),
    null,
  );
  assert.equal(parseImageInfo({}, "f.jpg"), null);
});

test("fetchCropPhoto asks the summary first, then Commons, and returns the picture with its credit", async () => {
  const asked: string[] = [];
  const photo = await fetchCropPhoto("Solanum melongena", async (url) => {
    asked.push(url);
    return url.includes("rest_v1") ? summary : imageInfo;
  });
  assert.equal(asked[0], summaryUrl("Solanum melongena"));
  assert.equal(asked[1], imageInfoUrl("Solanum_melongena_24_08_2012_(1).JPG"));
  assert.equal(photo?.author, "Joydeep");
  assert.ok(photo?.uri.startsWith("https://upload.wikimedia.org/"));
});

test("fetchCropPhoto gives null and makes no second call when the page has no usable picture", async () => {
  let calls = 0;
  const photo = await fetchCropPhoto("Nothing here", async () => {
    calls++;
    return { type: "standard" };
  });
  assert.equal(photo, null);
  assert.equal(calls, 1);
});
