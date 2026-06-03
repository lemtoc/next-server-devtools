import { describe, expect, test } from "vitest";
import { clearNetworkEntries, createObservedFetch } from "./index";
import { createNetworkEventsRouteHandler } from "./events-route";

describe("createNetworkEventsRouteHandler", () => {
  test("streams a snapshot event when a client connects", async () => {
    clearNetworkEntries();

    const observedFetch = createObservedFetch(async () => new Response("ok"), {
      source: "server",
    });
    await observedFetch("https://api.example.test/snapshot");

    const handlers = createNetworkEventsRouteHandler({ enabled: true });
    const response = await handlers.GET(
      new Request("https://app.example.test/api/next-server-devtools/network/events"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    const chunk = await reader?.read();
    await reader?.cancel();

    const text = new TextDecoder().decode(chunk?.value);

    expect(text).toContain("event: snapshot");
    expect(text).toContain("https://api.example.test/snapshot");
  });

  test("streams entry events after a connected client observes a request", async () => {
    clearNetworkEntries();

    const handlers = createNetworkEventsRouteHandler({ enabled: true });
    const response = await handlers.GET(
      new Request("https://app.example.test/api/next-server-devtools/network/events"),
    );
    const reader = response.body?.getReader();

    await reader?.read();

    const observedFetch = createObservedFetch(async () => new Response("ok"), {
      source: "server",
    });
    await observedFetch("https://api.example.test/live");

    const chunk = await reader?.read();
    await reader?.cancel();

    const text = new TextDecoder().decode(chunk?.value);

    expect(text).toContain("event: entry");
    expect(text).toContain("https://api.example.test/live");
  });
});
