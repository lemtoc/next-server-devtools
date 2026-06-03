import { installServerFetchObserver } from "./core";
import { DevtoolsDock } from "./devtools-dock";

export type NextServerDevtoolsProps = {
  apiBasePath?: string;
  clearOnReload?: boolean;
  enabled?: boolean;
};

export function NextServerDevtools({
  apiBasePath,
  clearOnReload,
  enabled = process.env.NODE_ENV === "development",
}: NextServerDevtoolsProps) {
  if (!enabled) {
    return null;
  }

  if (typeof window === "undefined") {
    installServerFetchObserver({ enabled: true });
  }

  return <DevtoolsDock apiBasePath={apiBasePath} clearOnReload={clearOnReload} />;
}
