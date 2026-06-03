const formatSearch = (url: URL): string => {
  if (!url.search) {
    return "";
  }

  const params = Array.from(url.searchParams.entries()).map(([name, value]) => `${name}=${value}`);

  return `?${params.join("&")}`;
};

export const getNetworkDisplayName = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments.at(-1);

    if (!lastSegment) {
      return url.hostname;
    }

    return `${lastSegment}${formatSearch(url)}`;
  } catch {
    return rawUrl;
  }
};
