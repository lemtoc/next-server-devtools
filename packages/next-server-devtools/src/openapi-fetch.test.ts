import { describe, expect, test } from "vitest";
import { clearNetworkEntries, getNetworkSnapshot } from "./index";
import { createOpenApiFetchMiddleware } from "./openapi-fetch";

describe("createOpenApiFetchMiddleware", () => {
  test("records openapi-fetch request and response lifecycle", async () => {
    clearNetworkEntries();

    const middleware = createOpenApiFetchMiddleware();

    await middleware.onRequest({
      id: "request_1",
      request: new Request("https://api.example.test/users", {
        headers: {
          Authorization: "Bearer secret",
        },
      }),
      schemaPath: "/users",
    });

    await middleware.onResponse({
      id: "request_1",
      response: new Response(JSON.stringify({ users: [] }), {
        headers: {
          "content-type": "application/json",
        },
      }),
    });

    const [entry] = getNetworkSnapshot().entries;

    expect(entry?.id).toBe("request_1");
    expect(entry?.label).toBe("/users");
    expect(entry?.source).toBe("server");
    expect(entry?.status).toBe("success");
    expect(entry?.requestHeaders.authorization).toBe("[redacted]");
    expect(entry?.responseBody).toBe(JSON.stringify({ users: [] }));
  });
});
