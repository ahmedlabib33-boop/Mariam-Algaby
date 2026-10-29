import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";

// node --test runs this file in its own worker. Use dummy credentials and
// mocked storage only; neither real credentials nor live services are needed.
const testEnvironment = {
  ADMIN_PASSWORD: "local-api-test-password",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_localtest_mock",
  VERCEL_BLOB_API_URL: "https://blob-api.test/api/blob",
  NEXT_PUBLIC_VERCEL_BLOB_API_URL: undefined,
  VERCEL_BLOB_RETRIES: "0",
  VERCEL_OIDC_TOKEN: undefined,
  BLOB_STORE_ID: undefined,
  DEBUG: "",
  NEXT_PUBLIC_DEBUG: "",
};
const originalEnvironment = new Map();
const item = { id: "cake", name: "Cake", price: 250, photo: "" };
const menu = { items: [item] };
const jsonHeaders = { "content-type": "application/json" };

function metadata(etag = "current") {
  return {
    url: "https://localtest.public.blob.vercel-storage.com/menu/menu.json",
    pathname: "menu/menu.json",
    uploadedAt: "2026-10-28T12:00:00.000Z",
    etag,
  };
}

function request({ method = "GET", conditions = {}, body = menu, admin = true } = {}) {
  return new Request("https://site.test/api/menu", {
    method,
    headers: {
      ...(admin ? { "x-admin-password": testEnvironment.ADMIN_PASSWORD } : {}),
      "content-type": "application/json",
      ...conditions,
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}

const storageError = (code) => ({ error: { code, message: "Mocked storage failure" } });
const assertNoStore = (response) => assert.equal(response.headers.get("Cache-Control"), "no-store");

describe("admin menu storage safety", { concurrency: false }, () => {
  let GET, POST, agent, api, cdn, previousDispatcher;

  before(async () => {
    for (const [key, value] of Object.entries(testEnvironment)) {
      originalEnvironment.set(key, process.env[key]);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Set the test environment before the SDK is imported, including its
    // logging settings, so inherited credentials are never used or logged.
    ({ GET, POST } = await import("../api/menu.js"));
  });

  after(() => {
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    previousDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    api = agent.get("https://blob-api.test");
    cdn = agent.get("https://localtest.public.blob.vercel-storage.com");
  });

  afterEach(async () => {
    try {
      agent.assertNoPendingInterceptors();
    } finally {
      setGlobalDispatcher(previousDispatcher);
      await agent.close();
    }
  });

  function headReply(status = 200, data = metadata()) {
    api.intercept({ method: "GET", path: "/api/blob?url=menu%2Fmenu.json" })
      .reply(status, JSON.stringify(data), { headers: jsonHeaders });
  }

  function menuReply(status = 200, etag = "current") {
    cdn.intercept({ method: "GET", path: "/menu/menu.json" })
      .reply(status, status === 200 ? JSON.stringify(menu) : "", { headers: { ...jsonHeaders, etag } });
  }

  function publishReply(status = 200, data = metadata("saved"), headers) {
    api.intercept({ method: "PUT", path: "/api/blob/?pathname=menu%2Fmenu.json", ...(headers ? { headers } : {}) })
      .reply(status, JSON.stringify(data), { headers: jsonHeaders });
  }

  function backupReply(status = 200, data = metadata("backup")) {
    api.intercept({ method: "PUT", path: /^\/api\/blob\/\?pathname=menu%2Fhistory%2F\d+\.json$/ })
      .reply(status, JSON.stringify(data), { headers: jsonHeaders });
  }

  it("returns a fresh admin menu and its version, accepting quoted CDN ETags", async () => {
    headReply();
    menuReply(200, '"current"');

    const response = await GET(request());

    assert.equal(response.status, 200);
    assertNoStore(response);
    assert.equal(response.headers.get("ETag"), "current");
    assert.deepEqual(await response.json(), menu);
  });

  it("accepts the weak ETag the CDN sends with a compressed menu", async () => {
    headReply(200, metadata('"current"'));
    menuReply(200, 'W/"current"');

    const response = await GET(request());

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), menu);
  });

  it("still rejects an older menu behind a weak ETag", async () => {
    headReply();
    menuReply(200, 'W/"older"');

    const response = await GET(request());

    assert.equal(response.status, 503);
  });

  it("rejects an older cached menu before it can be edited", async () => {
    headReply();
    menuReply(200, "older");

    const response = await GET(request());

    assert.equal(response.status, 503);
    assertNoStore(response);
  });

  it("does not fall back to the sample menu when the CDN has a stale 404", async () => {
    headReply();
    menuReply(404);

    const response = await GET(request());

    assert.equal(response.status, 503);
    assertNoStore(response);
  });

  it("allows the first-publish fallback only when origin confirms no menu exists", async () => {
    headReply(404, storageError("not_found"));

    const response = await GET(request());

    assert.equal(response.status, 404);
    assertNoStore(response);
  });

  it("keeps editing paused during a metadata outage", async () => {
    headReply(500, storageError("service_unavailable"));

    const response = await GET(request());

    assert.equal(response.status, 503);
    assertNoStore(response);
  });

  it("keeps editing paused if origin metadata has no usable version", async () => {
    headReply(200, metadata(""));

    assert.equal((await GET(request())).status, 503);
  });

  it("preserves cached public menu reads without an admin metadata request", async () => {
    menuReply(200, "cached");

    const response = await GET(request({ admin: false }));

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /s-maxage=10/);
    assert.deepEqual(await response.json(), menu);
  });

  it("preserves the public first-menu fallback", async () => {
    menuReply(404);

    assert.equal((await GET(request({ admin: false }))).status, 404);
  });

  it("rejects unconditional, wildcard-update, and ambiguous publication", async () => {
    for (const conditions of [{}, { "If-Match": "*" }, { "If-Match": "current", "If-None-Match": "*" }, { "If-None-Match": "current" }]) {
      const response = await POST(request({ method: "POST", conditions }));
      assert.equal(response.status, 428);
      assertNoStore(response);
    }
  });

  it("still rejects invalid dessert data before a storage write", async () => {
    const response = await POST(request({ method: "POST", conditions: { "If-Match": "current" }, body: { items: [{ name: "Bad", price: -1 }] } }));

    assert.equal(response.status, 400);
  });

  it("updates only the loaded version and returns the next version", async () => {
    publishReply(200, metadata("saved"), { "x-if-match": "current", "x-allow-overwrite": "1" });
    backupReply();

    const response = await POST(request({ method: "POST", conditions: { "If-Match": "current" } }));
    const result = await response.json();

    assert.equal(response.status, 200);
    assertNoStore(response);
    assert.equal(response.headers.get("ETag"), "saved");
    assert.equal(result.etag, "saved");
    assert.equal(result.items[0].name, "Cake");
    assert.equal(result.warning, undefined);
  });

  it("rejects a concurrent update instead of overwriting it", async () => {
    publishReply(412, storageError("precondition_failed"), { "x-if-match": "older" });

    const response = await POST(request({ method: "POST", conditions: { "If-Match": "older" } }));

    assert.equal(response.status, 409);
    assertNoStore(response);
  });

  it("creates the first menu with overwriting disabled", async () => {
    publishReply(200, metadata("first"), { "x-allow-overwrite": "0" });
    backupReply();

    const response = await POST(request({ method: "POST", conditions: { "If-None-Match": "*" } }));

    assert.equal(response.status, 200);
    assert.equal((await response.json()).etag, "first");
  });

  it("reports a conflict if another editor publishes the first menu first", async () => {
    publishReply(400, storageError("bad_request"), { "x-allow-overwrite": "0" });
    headReply();

    const response = await POST(request({ method: "POST", conditions: { "If-None-Match": "*" } }));

    assert.equal(response.status, 409);
  });

  it("reports an actual menu-write outage as an unpublished failure", async () => {
    publishReply(500, storageError("service_unavailable"), { "x-if-match": "current" });

    const response = await POST(request({ method: "POST", conditions: { "If-Match": "current" } }));

    assert.equal(response.status, 503);
    assertNoStore(response);
  });

  it("reports an unavailable first-write attempt without assuming a conflict", async () => {
    publishReply(500, storageError("service_unavailable"), { "x-allow-overwrite": "0" });
    headReply(500, storageError("service_unavailable"));

    assert.equal((await POST(request({ method: "POST", conditions: { "If-None-Match": "*" } }))).status, 503);
  });

  it("keeps a successful publish successful if only its backup fails", async () => {
    publishReply(200, metadata("saved"), { "x-if-match": "current" });
    backupReply(500, storageError("service_unavailable"));

    const response = await POST(request({ method: "POST", conditions: { "If-Match": "current" } }));
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.etag, "saved");
    assert.equal(response.headers.get("ETag"), "saved");
    assert.match(result.warning, /published.*backup/i);
  });
});
