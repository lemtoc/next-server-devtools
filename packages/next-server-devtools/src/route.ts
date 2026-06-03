import { Hono } from "hono";
import { clearNetworkEntries, clearNetworkEntriesBefore, getNetworkSnapshot } from "./index";

export type NetworkRouteHandlerOptions = {
  enabled?: boolean;
};

type NextRouteHandler = (request: Request) => Response | Promise<Response>;

export type NetworkRouteHandlers = {
  DELETE: NextRouteHandler;
  GET: NextRouteHandler;
};

const createNotFoundResponse = (): Response =>
  Response.json({ error: "Not found" }, { status: 404 });

export const createNetworkRouteHandlers = (
  options: NetworkRouteHandlerOptions = {},
): NetworkRouteHandlers => {
  const app = new Hono();
  const isEnabled = options.enabled ?? true;

  app.get("*", (context) => {
    if (!isEnabled) {
      return createNotFoundResponse();
    }

    return context.json({
      ...getNetworkSnapshot(),
      generatedAt: new Date().toISOString(),
    });
  });

  app.delete("*", (context) => {
    if (!isEnabled) {
      return createNotFoundResponse();
    }

    const before = new URL(context.req.url).searchParams.get("before");
    const beforeEpochMs = before ? Number.parseInt(before, 10) : NaN;

    if (Number.isFinite(beforeEpochMs)) {
      clearNetworkEntriesBefore(beforeEpochMs);
    } else {
      clearNetworkEntries();
    }

    return context.json({ ok: true });
  });

  return {
    DELETE: (request) => app.fetch(request),
    GET: (request) => app.fetch(request),
  };
};

export const { DELETE, GET } = createNetworkRouteHandlers({
  enabled: process.env.NODE_ENV === "development",
});
