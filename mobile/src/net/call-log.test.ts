import assert from "node:assert/strict";
import { test } from "node:test";

import { classify, getCalls, resetCalls, startCall } from "./call-log";

test("classify names each tracked endpoint and keeps the parameters that matter", () => {
  const m = classify("https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR,T2M&community=AG&latitude=8.2&longitude=124.2&start=2001&end=2025&format=JSON");
  assert.equal(m?.source, "power");
  assert.equal(m?.endpoint, "power.larc.nasa.gov/api/temporal/monthly/point");
  assert.deepEqual(m?.params.map(([k]) => k), ["parameters", "latitude", "longitude", "start", "end", "community"]);
  assert.equal(classify("https://power.larc.nasa.gov/api/temporal/daily/point?latitude=8.2")?.source, "power-daily");
  assert.equal(classify("/api/srtm?lat=8.123&lon=124.234", "https://x.pages.dev/dashboard")?.source, "srtm");
  assert.equal(classify("https://api.opentopodata.org/v1/srtm30m?locations=1,2")?.source, "srtm");
  assert.equal(classify("https://routing.openstreetmap.de/routed-car/route/v1/driving/1,2;3,4")?.source, "osm");
  assert.equal(classify("https://example.com/other"), null);
});

test("startCall records a request and its result", () => {
  resetCalls();
  const done = startCall("https://power.larc.nasa.gov/api/temporal/monthly/point?latitude=8.2&longitude=124.2");
  assert.equal(getCalls()[0].status, "pending");
  done?.({ http: 200 });
  assert.equal(getCalls()[0].status, "ok");
  assert.equal(getCalls()[0].http, 200);
  const fail = startCall("https://power.larc.nasa.gov/api/temporal/daily/point?latitude=8.2");
  fail?.({ error: "Request timed out after 15000 ms" });
  assert.equal(getCalls()[0].status, "error");
  assert.equal(startCall("https://example.com/"), null);
  assert.equal(getCalls().length, 2);
});
