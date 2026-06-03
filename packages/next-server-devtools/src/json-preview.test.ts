import { describe, expect, test } from "vitest";
import { formatResponseBody, getJsonPreviewSummary } from "./json-preview";

describe("JSON preview helpers", () => {
  test("pretty prints JSON response bodies", () => {
    expect(formatResponseBody('{"users":[{"id":1,"name":"Ada"}]}')).toBe(
      '{\n  "users": [\n    {\n      "id": 1,\n      "name": "Ada"\n    }\n  ]\n}',
    );
  });

  test("summarizes the first JSON properties like a network preview", () => {
    expect(
      getJsonPreviewSummary({
        count: 1,
        extra: "hidden",
        meta: { ok: true },
        users: [{ id: 1, name: "Ada" }],
      }),
    ).toBe('{count: 1, extra: "hidden", meta: {ok: true}, ...}');
  });
});
