import { Hono } from "hono";
import { getNetworkSnapshot, subscribeNetworkEvents } from "./index";

export type NetworkEventsRouteHandlerOptions = {
  enabled?: boolean;
  keepAliveIntervalMs?: number;
};

type NextRouteHandler = (request: Request) => Response | Promise<Response>;

export type NetworkEventsRouteHandler = {
  GET: NextRouteHandler;
};

const createNotFoundResponse = (): Response =>
  Response.json({ error: "Not found" }, { status: 404 });

const createServerSentEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const createNetworkEventsResponse = (request: Request, keepAliveIntervalMs: number): Response => {
  const encoder = new TextEncoder();
  let keepAliveId: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        unsubscribe?.();

        if (keepAliveId) {
          clearInterval(keepAliveId);
        }

        controller.close();
      };

      enqueue(createServerSentEvent("snapshot", { type: "snapshot", ...getNetworkSnapshot() }));

      unsubscribe = subscribeNetworkEvents((event) => {
        enqueue(createServerSentEvent(event.type, event));
      });

      keepAliveId = setInterval(() => {
        enqueue(": keep-alive\n\n");
      }, keepAliveIntervalMs);

      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      isClosed = true;
      unsubscribe?.();

      if (keepAliveId) {
        clearInterval(keepAliveId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
};

export const createNetworkEventsRouteHandler = (
  options: NetworkEventsRouteHandlerOptions = {},
): NetworkEventsRouteHandler => {
  const app = new Hono();
  const isEnabled = options.enabled ?? true;
  const keepAliveIntervalMs = options.keepAliveIntervalMs ?? 30000;

  app.get("*", (context) => {
    if (!isEnabled) {
      return createNotFoundResponse();
    }

    return createNetworkEventsResponse(context.req.raw, keepAliveIntervalMs);
  });

  return {
    GET: (request) => app.fetch(request),
  };
};

export const { GET } = createNetworkEventsRouteHandler({
  enabled: process.env.NODE_ENV === "development",
});
