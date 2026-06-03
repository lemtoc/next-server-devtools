import { afterEach, describe, expect, test, vi } from "vitest";
import { clearNetworkEntries, createObservedFetch, getNetworkSnapshot } from "./index";
import { createNetworkRouteHandlers } from "./route";

describe("createNetworkRouteHandlers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns and clears the current network snapshot", async () => {
    clearNetworkEntries();

    const observedFetch = createObservedFetch(
      async () => new Response(JSON.stringify({ ok: true })),
      { source: "server" },
    );
    await observedFetch("https://api.example.test/current");

    const handlers = createNetworkRouteHandlers({ enabled: true });
    const snapshotResponse = await handlers.GET(
      new Request("https://app.example.test/api/next-server-devtools/network"),
    );

    expect(snapshotResponse.status).toBe(200);

    const payload = await snapshotResponse.json();

    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].url).toBe("https://api.example.test/current");

    const clearResponse = await handlers.DELETE(
      new Request("https://app.example.test/api/next-server-devtools/network", {
        method: "DELETE",
      }),
    );

    expect(clearResponse.status).toBe(200);
    expect(await clearResponse.json()).toEqual({ ok: true });
    expect(getNetworkSnapshot().entries).toHaveLength(0);
  });

  test("clears only entries before a requested epoch", async () => {
    clearNetworkEntries();
    vi.useFakeTimers();

    const observedFetch = createObservedFetch(async () => new Response("ok"), {
      source: "server",
    });

    vi.setSystemTime(new Date(1000));
    await observedFetch("https://api.example.test/old");

    vi.setSystemTime(new Date(2000));
    await observedFetch("https://api.example.test/current");

    const handlers = createNetworkRouteHandlers({ enabled: true });
    const response = await handlers.DELETE(
      new Request("https://app.example.test/api/next-server-devtools/network?before=1500", {
        method: "DELETE",
      }),
    );

    const [entry] = getNetworkSnapshot().entries;

    expect(response.status).toBe(200);
    expect(getNetworkSnapshot().entries).toHaveLength(1);
    expect(entry?.url).toBe("https://api.example.test/current");
  });

  test("returns not found when disabled", async () => {
    const handlers = createNetworkRouteHandlers({ enabled: false });
    const response = await handlers.GET(
      new Request("https://app.example.test/api/next-server-devtools/network"),
    );

    expect(response.status).toBe(404);
  });
});
