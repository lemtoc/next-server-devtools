"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import {
  clearNetworkEntries,
  createObservedFetch,
  subscribeNetworkEvents,
  type NetworkCaptureSource,
  type NetworkEntry,
  type NetworkEvent,
} from "./core";
import {
  formatResponseBody,
  getJsonPreviewSummary,
  parseJson,
  type JsonPrimitive,
  type JsonValue,
} from "./json-preview";
import { getNetworkDisplayName } from "./network-display";

type DetailTab = "headers" | "payload" | "preview" | "response" | "curl";

type SourceFilter = "all" | NetworkCaptureSource;

export type DevtoolsDockProps = {
  apiBasePath?: string;
  clearOnReload?: boolean;
};

type ResizeState = {
  startHeight: number;
  startY: number;
};

type IconName = "activity" | "chevron" | "copy" | "grip" | "trash" | "x";

const DEFAULT_API_BASE_PATH = "/api/next-server-devtools/network";
const DEFAULT_DRAWER_HEIGHT = 520;
const DRAWER_HANDLE_HEIGHT = 18;
const MAX_DRAWER_VIEWPORT_RATIO = 0.92;
const STORAGE_KEY_DRAWER_HEIGHT = "next-server-devtools:drawer-height";
const STORAGE_KEY_DRAWER_OPEN = "next-server-devtools:drawer-open";

const detailTabs: DetailTab[] = ["headers", "payload", "preview", "response", "curl"];

const detailTabLabels: Record<DetailTab, string> = {
  curl: "cURL",
  headers: "Headers",
  payload: "Payload",
  preview: "Preview",
  response: "Response",
};

const iconPaths: Record<IconName, ReactNode> = {
  activity: (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  grip: (
    <>
      <path d="M5 9h14" />
      <path d="M5 15h14" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 16H6L5 6" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

const styles = `
.nsd-root {
  color: #111827;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.nsd-open-button,
.nsd-icon-button,
.nsd-tab,
.nsd-source-button,
.nsd-clear-button,
.nsd-resize-handle,
.nsd-entry-button {
  appearance: none;
  border: 0;
  font: inherit;
}
.nsd-open-button {
  align-items: center;
  background: #111827;
  border-radius: 8px;
  bottom: 16px;
  box-shadow: 0 14px 34px rgba(17, 24, 39, 0.26);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  font-weight: 700;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  position: fixed;
  right: 16px;
  z-index: 2147483646;
}
.nsd-drawer {
  background: #f8fafc;
  border-top: 1px solid #cbd5e1;
  bottom: 0;
  box-shadow: 0 -18px 40px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  left: 0;
  min-height: 180px;
  position: fixed;
  right: 0;
  z-index: 2147483646;
}
.nsd-resize-handle {
  align-items: center;
  background: #e2e8f0;
  border-bottom: 1px solid #cbd5e1;
  color: #475569;
  cursor: ns-resize;
  display: flex;
  height: 18px;
  justify-content: center;
  padding: 0;
  touch-action: none;
}
.nsd-toolbar {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #dbe3ef;
  display: grid;
  gap: 10px;
  grid-template-columns: auto minmax(180px, 1fr) auto auto;
  min-height: 48px;
  padding: 8px 12px;
}
.nsd-title {
  align-items: center;
  color: #0f172a;
  display: inline-flex;
  font-size: 13px;
  font-weight: 800;
  gap: 8px;
  white-space: nowrap;
}
.nsd-search {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #0f172a;
  font-size: 13px;
  height: 32px;
  min-width: 0;
  padding: 0 10px;
}
.nsd-source-filter {
  background: #eef2f7;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  display: inline-flex;
  overflow: hidden;
}
.nsd-source-button {
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  height: 30px;
  padding: 0 10px;
}
.nsd-source-button[data-active="true"] {
  background: #fff;
  color: #0f172a;
}
.nsd-clear-button,
.nsd-icon-button {
  align-items: center;
  background: transparent;
  border-radius: 6px;
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  gap: 6px;
  height: 32px;
  justify-content: center;
  padding: 0 8px;
}
.nsd-clear-button:hover,
.nsd-icon-button:hover,
.nsd-open-button:hover {
  filter: brightness(0.96);
}
.nsd-content {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(280px, 38%) minmax(0, 1fr);
  min-height: 0;
}
.nsd-list {
  background: #fff;
  border-right: 1px solid #dbe3ef;
  min-height: 0;
  overflow: auto;
}
.nsd-list-header,
.nsd-entry-button {
  display: grid;
  grid-template-columns: 74px 78px minmax(0, 1fr) 76px 76px;
}
.nsd-list-header {
  background: #f1f5f9;
  border-bottom: 1px solid #dbe3ef;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  gap: 8px;
  padding: 7px 10px;
  position: sticky;
  text-transform: uppercase;
  top: 0;
}
.nsd-entry-button {
  background: transparent;
  border-bottom: 1px solid #eef2f7;
  color: #0f172a;
  cursor: pointer;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px;
  text-align: left;
  width: 100%;
}
.nsd-entry-button[data-selected="true"] {
  background: #e0f2fe;
}
.nsd-entry-button:hover {
  background: #f1f5f9;
}
.nsd-method {
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 800;
}
.nsd-source-badge,
.nsd-status-badge {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  height: 22px;
  justify-content: center;
  padding: 0 8px;
  width: fit-content;
}
.nsd-source-badge[data-source="server"] {
  background: #ecfdf5;
  color: #047857;
}
.nsd-source-badge[data-source="client"] {
  background: #eff6ff;
  color: #1d4ed8;
}
.nsd-status-badge[data-status="pending"] {
  background: #f1f5f9;
  color: #64748b;
}
.nsd-status-badge[data-status="success"] {
  background: #ecfdf5;
  color: #047857;
}
.nsd-status-badge[data-status="error"] {
  background: #fef2f2;
  color: #b91c1c;
}
.nsd-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nsd-muted {
  color: #64748b;
}
.nsd-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.nsd-detail-header {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #dbe3ef;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 48px;
  padding: 8px 12px;
}
.nsd-detail-title {
  font-size: 13px;
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nsd-tabs {
  background: #f8fafc;
  border-bottom: 1px solid #dbe3ef;
  display: flex;
  gap: 4px;
  padding: 6px 8px 0;
}
.nsd-tab {
  background: transparent;
  border-radius: 6px 6px 0 0;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  height: 32px;
  padding: 0 12px;
}
.nsd-tab[data-active="true"] {
  background: #fff;
  border: 1px solid #dbe3ef;
  border-bottom-color: #fff;
  color: #0f172a;
}
.nsd-panel {
  background: #fff;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.nsd-pre {
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.nsd-empty {
  align-items: center;
  color: #64748b;
  display: flex;
  font-size: 13px;
  height: 100%;
  justify-content: center;
  padding: 24px;
}
.nsd-preview {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.8;
  padding: 12px;
}
.nsd-preview details {
  margin-left: 12px;
}
.nsd-preview summary {
  cursor: pointer;
  list-style-position: outside;
}
.nsd-preview-key {
  color: #64748b;
}
.nsd-preview-string {
  color: #047857;
}
.nsd-preview-number {
  color: #1d4ed8;
}
.nsd-preview-boolean {
  color: #7c3aed;
}
.nsd-preview-null {
  color: #64748b;
}
@media (max-width: 760px) {
  .nsd-toolbar {
    grid-template-columns: 1fr auto;
  }
  .nsd-search,
  .nsd-source-filter {
    grid-column: 1 / -1;
  }
  .nsd-content {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(160px, 42%) minmax(0, 1fr);
  }
  .nsd-list {
    border-bottom: 1px solid #dbe3ef;
    border-right: 0;
  }
  .nsd-list-header,
  .nsd-entry-button {
    grid-template-columns: 62px 66px minmax(0, 1fr) 62px;
  }
  .nsd-duration-column {
    display: none;
  }
}
`;

const Icon = ({ name }: { name: IconName }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="16"
  >
    {iconPaths[name]}
  </svg>
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNetworkEntry = (value: unknown): value is NetworkEntry => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.method === "string" &&
    typeof value.url === "string" &&
    (value.source === "server" || value.source === "client") &&
    (value.status === "pending" || value.status === "success" || value.status === "error")
  );
};

const parseNetworkEvent = (data: string): NetworkEvent | null => {
  try {
    const value: unknown = JSON.parse(data);

    if (!isRecord(value) || typeof value.type !== "string") {
      return null;
    }

    if (value.type === "clear") {
      return { type: "clear" };
    }

    if (value.type === "entry" && isNetworkEntry(value.entry)) {
      return { entry: value.entry, type: "entry" };
    }

    if (
      value.type === "snapshot" &&
      typeof value.bodyLimitBytes === "number" &&
      Array.isArray(value.entries)
    ) {
      return {
        bodyLimitBytes: value.bodyLimitBytes,
        entries: value.entries.filter(isNetworkEntry),
        type: "snapshot",
      };
    }

    return null;
  } catch {
    return null;
  }
};

const formatDuration = (durationMs: number | null): string =>
  durationMs === null ? "-" : `${durationMs} ms`;

const stringifyHeaders = (headers: Record<string, string>): string =>
  Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

const getDetailText = (entry: NetworkEntry, tab: DetailTab): string => {
  if (tab === "headers") {
    const requestHeaders = stringifyHeaders(entry.requestHeaders);
    const responseHeaders = stringifyHeaders(entry.responseHeaders);

    return [
      `${entry.method} ${entry.url}`,
      "",
      "Request Headers",
      requestHeaders || "(empty)",
      "",
      "Response Headers",
      responseHeaders || "(empty)",
    ].join("\n");
  }

  if (tab === "payload") {
    return formatResponseBody(entry.requestBody);
  }

  if (tab === "response") {
    return entry.errorMessage ?? formatResponseBody(entry.responseBody);
  }

  if (tab === "curl") {
    return entry.curl;
  }

  return "";
};

const replaceEntry = (entries: NetworkEntry[], nextEntry: NetworkEntry): NetworkEntry[] => {
  const hasEntry = entries.some((entry) => entry.id === nextEntry.id);

  if (!hasEntry) {
    return [...entries, nextEntry];
  }

  return entries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry));
};

const createApiPathMatcher = (apiBasePath: string): ((request: Request) => boolean) => {
  const apiPathname = new URL(apiBasePath, window.location.href).pathname;

  return (request) => {
    const requestPathname = new URL(request.url, window.location.href).pathname;
    return !requestPathname.startsWith(apiPathname) && !requestPathname.startsWith("/_next/");
  };
};

const entryMatchesFilter = (
  entry: NetworkEntry,
  filter: string,
  sourceFilter: SourceFilter,
): boolean => {
  if (sourceFilter !== "all" && entry.source !== sourceFilter) {
    return false;
  }

  const normalizedFilter = filter.trim().toLowerCase();

  if (!normalizedFilter) {
    return true;
  }

  return [
    entry.method,
    entry.url,
    entry.label ?? "",
    entry.responseStatus?.toString() ?? "",
    entry.errorMessage ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedFilter));
};

const formatPrimitivePreview = (value: JsonPrimitive): string =>
  typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);

const primitiveClassName = (value: JsonPrimitive): string => {
  if (typeof value === "string") {
    return "nsd-preview-string";
  }

  if (typeof value === "number") {
    return "nsd-preview-number";
  }

  if (typeof value === "boolean") {
    return "nsd-preview-boolean";
  }

  return "nsd-preview-null";
};

function JsonPreviewNode({ name, value }: { name?: string; value: JsonValue }): ReactNode {
  if (Array.isArray(value)) {
    return (
      <details open={!name}>
        <summary>
          {name ? <span className="nsd-preview-key">{name}: </span> : null}
          <span>{getJsonPreviewSummary(value)}</span>
        </summary>
        {value.map((item, index) => (
          <JsonPreviewNode key={index} name={String(index)} value={item} />
        ))}
      </details>
    );
  }

  if (value !== null && typeof value === "object") {
    return (
      <details open={!name}>
        <summary>
          {name ? <span className="nsd-preview-key">{name}: </span> : null}
          <span>{getJsonPreviewSummary(value)}</span>
        </summary>
        {Object.entries(value).map(([key, item]) => (
          <JsonPreviewNode key={key} name={key} value={item} />
        ))}
      </details>
    );
  }

  return (
    <div>
      {name ? <span className="nsd-preview-key">{name}: </span> : null}
      <span className={primitiveClassName(value)}>{formatPrimitivePreview(value)}</span>
    </div>
  );
}

function PreviewPanel({ entry }: { entry: NetworkEntry }) {
  if (entry.errorMessage) {
    return <pre className="nsd-pre">{entry.errorMessage}</pre>;
  }

  const parsedJson = parseJson(entry.responseBody);

  if (!parsedJson.success) {
    return <div className="nsd-empty">{entry.responseBody ? "(not JSON)" : "(empty)"}</div>;
  }

  return (
    <div className="nsd-preview">
      <JsonPreviewNode value={parsedJson.value} />
    </div>
  );
}

export function DevtoolsDock({
  apiBasePath = DEFAULT_API_BASE_PATH,
  clearOnReload = true,
}: DevtoolsDockProps) {
  const [entries, setEntries] = useState<NetworkEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("headers");
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(DEFAULT_DRAWER_HEIGHT);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  const getMaxDrawerHeight = () =>
    Math.max(DRAWER_HANDLE_HEIGHT, Math.floor(window.innerHeight * MAX_DRAWER_VIEWPORT_RATIO));

  const clampDrawerHeight = (height: number) =>
    Math.min(Math.max(height, DRAWER_HANDLE_HEIGHT), getMaxDrawerHeight());

  const filteredEntries = useMemo(
    () => entries.filter((entry) => entryMatchesFilter(entry, filter, sourceFilter)),
    [entries, filter, sourceFilter],
  );

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null;

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId(null);
      return;
    }

    if (selectedEntry.id !== selectedId) {
      setSelectedId(selectedEntry.id);
    }
  }, [selectedEntry, selectedId]);

  useEffect(() => {
    const storedHeight = window.localStorage.getItem(STORAGE_KEY_DRAWER_HEIGHT);
    const parsedHeight = storedHeight ? Number.parseInt(storedHeight, 10) : NaN;

    setDrawerHeight(
      Number.isFinite(parsedHeight)
        ? clampDrawerHeight(parsedHeight)
        : clampDrawerHeight(DEFAULT_DRAWER_HEIGHT),
    );
    setIsOpen(window.localStorage.getItem(STORAGE_KEY_DRAWER_OPEN) === "true");
    setHasLoadedPreferences(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY_DRAWER_OPEN, String(isOpen));
  }, [hasLoadedPreferences, isOpen]);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY_DRAWER_HEIGHT, String(drawerHeight));
  }, [drawerHeight, hasLoadedPreferences]);

  useEffect(() => {
    const handleWindowResize = () => {
      setDrawerHeight((currentHeight) => clampDrawerHeight(currentHeight));
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!clearOnReload) {
      return;
    }

    const pageLoadStartedAt = Math.floor(performance.timeOrigin);
    void fetch(`${apiBasePath}?before=${pageLoadStartedAt}`, { method: "DELETE" });
  }, [apiBasePath, clearOnReload]);

  useEffect(() => {
    const originalFetch = window.fetch;
    const observedFetch = createObservedFetch(originalFetch, {
      shouldObserve: createApiPathMatcher(apiBasePath),
      source: "client",
    });

    window.fetch = observedFetch;

    return () => {
      if (window.fetch === observedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [apiBasePath]);

  useEffect(() => {
    const unsubscribe = subscribeNetworkEvents((event) => {
      if (event.type === "snapshot") {
        setEntries((currentEntries) => {
          const clientEntries = currentEntries.filter((entry) => entry.source === "client");
          return [...event.entries, ...clientEntries];
        });
        return;
      }

      if (event.type === "entry") {
        setEntries((currentEntries) => replaceEntry(currentEntries, event.entry));
        return;
      }

      setEntries((currentEntries) => currentEntries.filter((entry) => entry.source !== "client"));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${apiBasePath}/events`);

    const handleEvent = (event: Event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
        return;
      }

      const payload = parseNetworkEvent(event.data);

      if (!payload) {
        return;
      }

      setConnectionError(null);

      if (payload.type === "snapshot") {
        setEntries((currentEntries) => {
          const clientEntries = currentEntries.filter((entry) => entry.source === "client");
          return [...payload.entries, ...clientEntries];
        });
        return;
      }

      if (payload.type === "entry") {
        setEntries((currentEntries) => replaceEntry(currentEntries, payload.entry));
        return;
      }

      setEntries([]);
    };

    const handleError = () => {
      setConnectionError("SSE disconnected");
    };

    eventSource.addEventListener("snapshot", handleEvent);
    eventSource.addEventListener("entry", handleEvent);
    eventSource.addEventListener("clear", handleEvent);
    eventSource.addEventListener("error", handleError);

    return () => eventSource.close();
  }, [apiBasePath]);

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    resizeStateRef.current = {
      startHeight: drawerHeight,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: PointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    setDrawerHeight(
      clampDrawerHeight(resizeState.startHeight + resizeState.startY - event.clientY),
    );
  };

  const stopResize = (event: PointerEvent<HTMLButtonElement>) => {
    resizeStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearEntries = async () => {
    await fetch(apiBasePath, { method: "DELETE" });
    clearNetworkEntries();
  };

  const copyDetailText = async () => {
    if (!selectedEntry) {
      return;
    }

    await navigator.clipboard.writeText(getDetailText(selectedEntry, detailTab));
  };

  if (!hasLoadedPreferences) {
    return null;
  }

  return (
    <div className="nsd-root">
      <style>{styles}</style>
      {isOpen ? (
        <section className="nsd-drawer" style={{ height: drawerHeight }}>
          <button
            aria-label="Resize network drawer"
            className="nsd-resize-handle"
            onPointerCancel={stopResize}
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={stopResize}
            type="button"
          >
            <Icon name="grip" />
          </button>
          <div className="nsd-toolbar">
            <div className="nsd-title">
              <Icon name="activity" />
              Network
              <span className="nsd-muted">{entries.length}</span>
            </div>
            <input
              className="nsd-search"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter"
              type="search"
              value={filter}
            />
            <div aria-label="Capture source" className="nsd-source-filter" role="group">
              {(["all", "server", "client"] satisfies SourceFilter[]).map((source) => (
                <button
                  className="nsd-source-button"
                  data-active={sourceFilter === source}
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  type="button"
                >
                  {source === "all" ? "All" : source === "server" ? "Server" : "Client"}
                </button>
              ))}
            </div>
            <div>
              <button className="nsd-clear-button" onClick={clearEntries} type="button">
                <Icon name="trash" />
                Clear
              </button>
              <button
                aria-label="Close network drawer"
                className="nsd-icon-button"
                onClick={() => setIsOpen(false)}
                title="Close"
                type="button"
              >
                <Icon name="x" />
              </button>
            </div>
          </div>
          <div className="nsd-content">
            <div className="nsd-list">
              <div className="nsd-list-header">
                <span>Method</span>
                <span>Source</span>
                <span>Name</span>
                <span>Status</span>
                <span className="nsd-duration-column">Time</span>
              </div>
              {filteredEntries.length === 0 ? (
                <div className="nsd-empty">{connectionError ?? "No requests"}</div>
              ) : (
                filteredEntries.map((entry) => (
                  <button
                    className="nsd-entry-button"
                    data-selected={selectedEntry?.id === entry.id}
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    type="button"
                  >
                    <span className="nsd-method">{entry.method}</span>
                    <span className="nsd-source-badge" data-source={entry.source}>
                      {entry.source === "server" ? "Server" : "Client"}
                    </span>
                    <span className="nsd-url" title={entry.url}>
                      {entry.label ?? getNetworkDisplayName(entry.url)}
                    </span>
                    <span className="nsd-status-badge" data-status={entry.status}>
                      {entry.responseStatus ?? entry.status}
                    </span>
                    <span className="nsd-muted nsd-duration-column">
                      {formatDuration(entry.durationMs)}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="nsd-detail">
              {selectedEntry ? (
                <>
                  <div className="nsd-detail-header">
                    <div className="nsd-detail-title" title={selectedEntry.url}>
                      {selectedEntry.method} {selectedEntry.url}
                    </div>
                    <button
                      aria-label="Copy selected detail"
                      className="nsd-icon-button"
                      onClick={copyDetailText}
                      title="Copy"
                      type="button"
                    >
                      <Icon name="copy" />
                    </button>
                  </div>
                  <div className="nsd-tabs">
                    {detailTabs.map((tab) => (
                      <button
                        className="nsd-tab"
                        data-active={detailTab === tab}
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        type="button"
                      >
                        {detailTabLabels[tab]}
                      </button>
                    ))}
                  </div>
                  <div className="nsd-panel">
                    {detailTab === "preview" ? (
                      <PreviewPanel entry={selectedEntry} />
                    ) : (
                      <pre className="nsd-pre">{getDetailText(selectedEntry, detailTab)}</pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="nsd-empty">Select a request</div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <button className="nsd-open-button" onClick={() => setIsOpen(true)} type="button">
          <Icon name="activity" />
          Network
        </button>
      )}
    </div>
  );
}
