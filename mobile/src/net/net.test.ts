/// <reference types="node" />
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { onlineManager } from "@tanstack/react-query";
import { fetchWithTimeout, TimeoutError } from "./fetch";
import { onReconnect } from "./reconnect";

let server: Server;
let base = "";
before(async () => {
  server = createServer((req, res) => {
    const wait = Number(new URL(req.url ?? "/", "http://x").searchParams.get("wait") ?? 0);
    const t = setTimeout(() => res.end("ok"), wait);
    req.on("close", () => clearTimeout(t));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

test("fetchWithTimeout: fast response passes through", async () => {
  const res = await fetchWithTimeout(`${base}/?wait=0`, undefined, 500);
  assert.equal(await res.text(), "ok");
});

test("fetchWithTimeout: slow response fails with TimeoutError", async () => {
  await assert.rejects(fetchWithTimeout(`${base}/?wait=2000`, undefined, 100), TimeoutError);
});

test("fetchWithTimeout: a caller's signal still cancels, and the timeout still applies when one is passed", async () => {
  const caller = new AbortController();
  const p = fetchWithTimeout(`${base}/?wait=2000`, { signal: caller.signal }, 1000);
  setTimeout(() => caller.abort(), 50);
  await assert.rejects(p, (e: Error) => e.name === "AbortError");

  const idle = new AbortController(); // passed but never aborted: the old code lost the timeout here
  await assert.rejects(fetchWithTimeout(`${base}/?wait=2000`, { signal: idle.signal }, 100), TimeoutError);
});

test("onReconnect: fires only on offline to online", () => {
  let calls = 0;
  onlineManager.setOnline(true);
  const stop = onReconnect(() => calls++);
  onlineManager.setOnline(true);
  assert.equal(calls, 0);
  onlineManager.setOnline(false);
  assert.equal(calls, 0);
  onlineManager.setOnline(true);
  assert.equal(calls, 1);
  stop();
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  assert.equal(calls, 1);
});

test("onReconnect runNow: runs at once only when online", () => {
  let calls = 0;
  onlineManager.setOnline(false);
  onReconnect(() => calls++, { runNow: true })();
  assert.equal(calls, 0);
  onlineManager.setOnline(true);
  onReconnect(() => calls++, { runNow: true })();
  assert.equal(calls, 1);
});
