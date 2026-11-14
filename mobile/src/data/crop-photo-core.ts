import { normalizeName } from "../lots/crop-search-core";
import type { EcocropNames } from "../types";

// Pictures for crops we have no bundled picture for (#169): the crop's scientific name goes to the
// Wikipedia page-summary API for the page's lead picture, then to the Wikimedia Commons API for that
// picture's author and license. Free, no key. Only a crop name is sent, nothing about the farmer or
// the lots. No React Native imports, so it runs in Node tests. Run-time code: crop-photo.ts.

export interface CropPhoto {
  /** Small picture, hosted by Wikimedia. */
  uri: string;
  /** Commons file page, which shows the full credit. */
  page: string;
  author: string;
  license: string;
  licenseUrl: string | null;
}

export type FetchJson = (url: string) => Promise<unknown>;

/** Scientific name for a crop saved from the search (`other:<name>`), only when the name points to exactly one Ecocrop species. */
export function sciNameFor(
  name: string,
  index: EcocropNames | null,
): string | null {
  const key = normalizeName(name);
  if (!key || !index) return null;
  const hits = new Set<string>();
  for (const s of index.species) {
    if (
      normalizeName(s.sci) === key ||
      s.names.some((n) => normalizeName(n) === key)
    )
      hits.add(s.sci);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

/** Licenses we can credit and reuse: CC0, public domain, CC BY and CC BY-SA. No NonCommercial, NoDerivatives or GFDL-only. */
export const isAcceptableLicense = (short: string) =>
  /^(cc0( 1\.0)?|public domain|pd|cc by(-sa)? \d(\.\d)?( [a-z]{2,3})?)$/i.test(
    short.trim(),
  );

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;

export const summaryUrl = (sci: string) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(sci.trim().replace(/ /g, "_"))}?redirect=true`;

export const imageInfoUrl = (fileName: string) =>
  "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=" +
  encodeURIComponent(`File:${fileName}`);

/** The picture of a standard Wikipedia page that is hosted on Commons (not an English-Wikipedia-only upload), else null. */
export function parseSummary(
  json: unknown,
): { thumb: string; fileName: string } | null {
  const j = obj(json);
  if (!j || j.type !== "standard") return null;
  const thumb = str(obj(j.thumbnail)?.source);
  const original = str(obj(j.originalimage)?.source);
  if (!thumb || !original || !original.includes("/wikipedia/commons/"))
    return null;
  const last = original.split("?")[0].split("/").pop();
  if (!last) return null;
  try {
    return { thumb, fileName: decodeURIComponent(last) };
  } catch {
    return null;
  }
}

/** Author and license from a Commons `imageinfo` answer, or null when there is no credit or the license is not one we accept. */
export function parseImageInfo(
  json: unknown,
  fileName: string,
): Omit<CropPhoto, "uri"> | null {
  const pages = obj(obj(obj(json)?.query)?.pages);
  const page = pages ? obj(Object.values(pages)[0]) : null;
  const info = Array.isArray(page?.imageinfo) ? obj(page.imageinfo[0]) : null;
  const meta = obj(info?.extmetadata);
  if (!meta) return null;
  const license = str(obj(meta.LicenseShortName)?.value);
  const author = str(obj(meta.Artist)?.value);
  if (!license || !author || !isAcceptableLicense(license)) return null;
  const cleanAuthor = stripHtml(author);
  if (!cleanAuthor) return null;
  return {
    page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`,
    author: cleanAuthor,
    license: license.trim(),
    licenseUrl: str(obj(meta.LicenseUrl)?.value),
  };
}

/** Looks the picture up. Null when there is no usable picture or credit (the app then shows the placeholder). Throws on a network error. */
export async function fetchCropPhoto(
  sci: string,
  getJson: FetchJson,
): Promise<CropPhoto | null> {
  const found = parseSummary(await getJson(summaryUrl(sci)));
  if (!found) return null;
  const credit = parseImageInfo(
    await getJson(imageInfoUrl(found.fileName)),
    found.fileName,
  );
  return credit ? { uri: found.thumb, ...credit } : null;
}

/** "Photo: Joydeep, CC BY-SA 3.0 (Wikimedia Commons)". */
export const photoCreditLine = (p: Pick<CropPhoto, "author" | "license">) =>
  `Photo: ${p.author}, ${p.license} (Wikimedia Commons)`;
