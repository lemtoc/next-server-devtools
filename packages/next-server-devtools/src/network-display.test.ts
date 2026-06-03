import { describe, expect, test } from "vitest";
import { getNetworkDisplayName } from "./network-display";

describe("getNetworkDisplayName", () => {
  test("uses the hostname for document root requests", () => {
    expect(getNetworkDisplayName("http://localhost:3000/")).toBe("localhost");
  });

  test("uses the final path segment and query for API requests", () => {
    expect(
      getNetworkDisplayName(
        "http://localhost:3000/api/playground/upstream?token=client-secret&query=visible",
      ),
    ).toBe("upstream?token=client-secret&query=visible");
  });

  test("keeps redacted query values readable in display names", () => {
    expect(
      getNetworkDisplayName(
        "http://localhost:3000/api/playground/upstream?token=%5Bredacted%5D&query=visible",
      ),
    ).toBe("upstream?token=[redacted]&query=visible");
  });
});
