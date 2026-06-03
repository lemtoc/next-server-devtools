const REDACTED_VALUE = "[redacted]";
const DEFAULT_BODY_LIMIT_BYTES = 64 * 1024;

const SENSITIVE_HEADER_PARTS = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "session",
  "token",
];

const SENSITIVE_QUERY_PARTS = ["password", "secret", "token"];

export type NetworkCaptureSource = "server" | "client";

export type NetworkEntryStatus = "pending" | "success" | "error";

export type NetworkEntry = {
  id: string;
  source: NetworkCaptureSource;
  label: string | null;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  requestBodyTruncated: boolean;
  responseStatus: number | null;
  responseStatusText: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  responseBodyTruncated: boolean;
  startedAt: string;
  startedAtEpochMs: number;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  curl: string;
  status: NetworkEntryStatus;
};

export type NetworkSnapshot = {
  bodyLimitBytes: number;
  entries: NetworkEntry[];
};

export type NetworkEvent =
  | {
      type: "snapshot";
      bodyLimitBytes: number;
      entries: NetworkEntry[];
    }
  | {
      type: "entry";
      entry: NetworkEntry;
    }
  | {
      type: "clear";
    };

type BodySnapshot = {
  text: string | null;
  truncated: boolean;
};

type NetworkEventListener = (event: NetworkEvent) => void;

type NetworkState = {
  entries: NetworkEntry[];
  listeners?: Set<NetworkEventListener>;
};

type ServerFetchObserverInstallState = {
  observedFetch: typeof fetch;
  originalFetch: typeof fetch;
};

export type ObservedFetchOptions = {
  label?: string;
  shouldObserve?: (request: Request) => boolean;
  source: NetworkCaptureSource;
};

export type ServerFetchObserverOptions = {
  enabled?: boolean;
  label?: string;
};

export type RecordNetworkRequestOptions = {
  id?: string;
  label?: string;
  request: Request;
  source: NetworkCaptureSource;
};

export type RecordNetworkResponseOptions = {
  id: string;
  response: Response;
};

export type RecordNetworkErrorOptions = {
  error: unknown;
  id: string;
};

declare global {
  var __nextServerDevtoolsFetchObserverState: ServerFetchObserverInstallState | undefined;
  var __nextServerDevtoolsNetworkState: NetworkState | undefined;
}

const getState = (): NetworkState => {
  const currentState = globalThis.__nextServerDevtoolsNetworkState;

  if (currentState) {
    return currentState;
  }

  const nextState: NetworkState = { entries: [] };
  globalThis.__nextServerDevtoolsNetworkState = nextState;
  return nextState;
};

const getListeners = (): Set<NetworkEventListener> => {
  const state = getState();

  if (!state.listeners) {
    state.listeners = new Set<NetworkEventListener>();
  }

  return state.listeners;
};

const emitNetworkEvent = (event: NetworkEvent): void => {
  for (const listener of getListeners()) {
    listener(event);
  }
};

const isSensitiveName = (name: string, sensitiveParts: string[]): boolean => {
  const normalizedName = name.toLowerCase();
  return sensitiveParts.some((part) => normalizedName.includes(part));
};

const sanitizeHeaderValue = (name: string, value: string): string => {
  if (isSensitiveName(name, SENSITIVE_HEADER_PARTS)) {
    return REDACTED_VALUE;
  }

  return value;
};

const headersToRecord = (headers: Headers): Record<string, string> =>
  Object.fromEntries(
    Array.from(headers.entries()).map(([name, value]) => [name, sanitizeHeaderValue(name, value)]),
  );

const sanitizeUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);

    for (const key of Array.from(url.searchParams.keys())) {
      if (isSensitiveName(key, SENSITIVE_QUERY_PARTS)) {
        url.searchParams.set(key, REDACTED_VALUE);
      }
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

const limitBody = (body: string): BodySnapshot => {
  if (body.length <= DEFAULT_BODY_LIMIT_BYTES) {
    return { text: body, truncated: false };
  }

  return {
    text: `${body.slice(0, DEFAULT_BODY_LIMIT_BYTES)}\n\n[truncated]`,
    truncated: true,
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};

const readBody = async (source: Request | Response): Promise<BodySnapshot> => {
  try {
    const body = await source.clone().text();

    if (!body) {
      return { text: null, truncated: false };
    }

    return limitBody(body);
  } catch (error) {
    return {
      text: `Body unavailable: ${getErrorMessage(error)}`,
      truncated: false,
    };
  }
};

const buildCurlCommand = (
  request: Request,
  requestBody: string | null,
  requestBodyTruncated: boolean,
): string => {
  const lines = [`curl ${shellQuote(sanitizeUrl(request.url))}`];

  if (request.method !== "GET") {
    lines.push(`  -X ${shellQuote(request.method)}`);
  }

  for (const [name, value] of request.headers.entries()) {
    lines.push(`  -H ${shellQuote(`${name}: ${sanitizeHeaderValue(name, value)}`)}`);
  }

  if (requestBody) {
    const body = requestBodyTruncated ? requestBody.replace(/\n\n\[truncated\]$/, "") : requestBody;
    lines.push(`  --data-raw ${shellQuote(body)}`);
  }

  return lines.join(" \\\n");
};

const createEntryId = (): string => {
  if (globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const appendEntry = (entry: NetworkEntry): void => {
  const state = getState();
  state.entries = [...state.entries, entry];
  emitNetworkEvent({ entry, type: "entry" });
};

const updateEntry = (id: string, createNextEntry: (entry: NetworkEntry) => NetworkEntry): void => {
  const state = getState();
  let updatedEntry: NetworkEntry | null = null;

  state.entries = state.entries.map((entry) => {
    if (entry.id !== id) {
      return entry;
    }

    updatedEntry = createNextEntry(entry);
    return updatedEntry;
  });

  if (updatedEntry) {
    emitNetworkEvent({ entry: updatedEntry, type: "entry" });
  }
};

const createRequest = (input: RequestInfo | URL, init?: RequestInit): Request =>
  new Request(input, init);

export const recordNetworkRequest = async (
  options: RecordNetworkRequestOptions,
): Promise<NetworkEntry> => {
  const requestBody = await readBody(options.request);
  const startedAtEpochMs = Date.now();
  const entry: NetworkEntry = {
    completedAt: null,
    curl: buildCurlCommand(options.request, requestBody.text, requestBody.truncated),
    durationMs: null,
    errorMessage: null,
    id: options.id ?? createEntryId(),
    label: options.label ?? null,
    method: options.request.method,
    requestBody: requestBody.text,
    requestBodyTruncated: requestBody.truncated,
    requestHeaders: headersToRecord(options.request.headers),
    responseBody: null,
    responseBodyTruncated: false,
    responseHeaders: {},
    responseStatus: null,
    responseStatusText: null,
    source: options.source,
    startedAt: new Date(startedAtEpochMs).toISOString(),
    startedAtEpochMs,
    status: "pending",
    url: sanitizeUrl(options.request.url),
  };

  appendEntry(entry);

  return entry;
};

export const recordNetworkResponse = async (
  options: RecordNetworkResponseOptions,
): Promise<void> => {
  const responseBody = await readBody(options.response);
  const completedAtEpochMs = Date.now();

  updateEntry(options.id, (currentEntry) => ({
    ...currentEntry,
    completedAt: new Date(completedAtEpochMs).toISOString(),
    durationMs: completedAtEpochMs - currentEntry.startedAtEpochMs,
    responseBody: responseBody.text,
    responseBodyTruncated: responseBody.truncated,
    responseHeaders: headersToRecord(options.response.headers),
    responseStatus: options.response.status,
    responseStatusText: options.response.statusText,
    status: options.response.ok ? "success" : "error",
  }));
};

export const recordNetworkError = (options: RecordNetworkErrorOptions): void => {
  const completedAtEpochMs = Date.now();

  updateEntry(options.id, (currentEntry) => ({
    ...currentEntry,
    completedAt: new Date(completedAtEpochMs).toISOString(),
    durationMs: completedAtEpochMs - currentEntry.startedAtEpochMs,
    errorMessage: getErrorMessage(options.error),
    status: "error",
  }));
};

export const createObservedFetch = (
  fetchImplementation: typeof fetch,
  options: ObservedFetchOptions,
): typeof fetch => {
  const observedFetch: typeof fetch = async (input, init) => {
    const request = createRequest(input, init);

    if (options.shouldObserve && !options.shouldObserve(request)) {
      return fetchImplementation(request);
    }

    const entry = await recordNetworkRequest({
      label: options.label,
      request,
      source: options.source,
    });

    try {
      const response = await fetchImplementation(request);
      await recordNetworkResponse({ id: entry.id, response });

      return response;
    } catch (error) {
      recordNetworkError({ error, id: entry.id });

      throw error;
    }
  };

  return observedFetch;
};

export const getNetworkSnapshot = (): NetworkSnapshot => ({
  bodyLimitBytes: DEFAULT_BODY_LIMIT_BYTES,
  entries: [...getState().entries],
});

export const clearNetworkEntries = (): void => {
  const state = getState();
  state.entries = [];
  emitNetworkEvent({ type: "clear" });
};

export const clearNetworkEntriesBefore = (epochMs: number): void => {
  const state = getState();
  state.entries = state.entries.filter((entry) => entry.startedAtEpochMs >= epochMs);
  emitNetworkEvent({ type: "snapshot", ...getNetworkSnapshot() });
};

export const subscribeNetworkEvents = (listener: NetworkEventListener): (() => void) => {
  const listeners = getListeners();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const installServerFetchObserver = (
  options: ServerFetchObserverOptions = {},
): (() => void) => {
  if (options.enabled === false) {
    return () => {};
  }

  const currentState = globalThis.__nextServerDevtoolsFetchObserverState;

  if (currentState) {
    return () => {};
  }

  const originalFetch = globalThis.fetch;
  const observedFetch = createObservedFetch(originalFetch, {
    label: options.label,
    source: "server",
  });

  globalThis.fetch = observedFetch;
  globalThis.__nextServerDevtoolsFetchObserverState = {
    observedFetch,
    originalFetch,
  };

  return () => {
    const installState = globalThis.__nextServerDevtoolsFetchObserverState;

    if (!installState || installState.observedFetch !== observedFetch) {
      return;
    }

    if (globalThis.fetch === observedFetch) {
      globalThis.fetch = installState.originalFetch;
    }

    globalThis.__nextServerDevtoolsFetchObserverState = undefined;
  };
};
