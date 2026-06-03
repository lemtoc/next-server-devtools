import { describe, expect, test } from "vitest";
import {
  clearNetworkEntries,
  createObservedFetch,
  getNetworkSnapshot,
  installServerFetchObserver,
} from "./index";

describe("createObservedFetch", () => {
  test("records server fetches with redacted sensitive request data", async () => {
    clearNetworkEntries();

    const upstreamFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ id: "user_1", name: "Ada" }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=abc",
        },
        status: 201,
        statusText: "Created",
      });

    const observedFetch = createObservedFetch(upstreamFetch, {
      source: "server",
    });

    await observedFetch("https://api.example.test/users?token=secret&id=1", {
      body: JSON.stringify({ name: "Ada" }),
      headers: {
        Authorization: "Bearer secret",
        "x-public": "visible",
      },
      method: "POST",
    });

    const snapshot = getNetworkSnapshot();
    const [entry] = snapshot.entries;

    expect(snapshot.entries).toHaveLength(1);
    expect(entry?.source).toBe("server");
    expect(entry?.status).toBe("success");
    expect(entry?.method).toBe("POST");
    expect(entry?.responseStatus).toBe(201);
    expect(entry?.requestHeaders.authorization).toBe("[redacted]");
    expect(entry?.requestHeaders["x-public"]).toBe("visible");
    expect(entry?.responseHeaders["set-cookie"]).toBe("[redacted]");
    expect(entry?.requestBody).toBe(JSON.stringify({ name: "Ada" }));
    expect(entry?.responseBody).toBe(JSON.stringify({ id: "user_1", name: "Ada" }));
    expect(entry?.url).toBe("https://api.example.test/users?token=%5Bredacted%5D&id=1");
    expect(entry?.curl).toContain("authorization: [redacted]");
    expect(entry?.curl).not.toContain("Bearer secret");
  });

  test("installs a global server fetch observer without double wrapping", async () => {
    clearNetworkEntries();

    const originalFetch = globalThis.fetch;
    const upstreamFetch: typeof fetch = async () => new Response("ok");

    try {
      globalThis.fetch = upstreamFetch;

      const cleanupFirstInstall = installServerFetchObserver({ enabled: true });
      const firstObservedFetch = globalThis.fetch;
      const cleanupSecondInstall = installServerFetchObserver({ enabled: true });

      expect(globalThis.fetch).toBe(firstObservedFetch);

      await fetch("https://api.example.test/ping");

      expect(getNetworkSnapshot().entries).toHaveLength(1);

      cleanupSecondInstall();
      expect(globalThis.fetch).toBe(firstObservedFetch);

      cleanupFirstInstall();
      expect(globalThis.fetch).toBe(upstreamFetch);
    } finally {
      globalThis.fetch = originalFetch;
      clearNetworkEntries();
    }
  });

  test("can skip requests that should not be observed", async () => {
    clearNetworkEntries();

    const observedFetch = createObservedFetch(async () => new Response("ok"), {
      shouldObserve: (request) => !request.url.includes("/api/next-server-devtools/"),
      source: "client",
    });

    await observedFetch("https://app.example.test/api/next-server-devtools/network");
    await observedFetch("https://app.example.test/api/playground/upstream");

    const [entry] = getNetworkSnapshot().entries;

    expect(getNetworkSnapshot().entries).toHaveLength(1);
    expect(entry?.source).toBe("client");
    expect(entry?.url).toBe("https://app.example.test/api/playground/upstream");
  });
});
