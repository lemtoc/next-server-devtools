export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type JsonParseResult =
  | {
      success: true;
      value: JsonValue;
    }
  | {
      success: false;
    };

const MAX_PREVIEW_ITEMS = 3;
const MAX_PREVIEW_PROPERTIES = 3;
const MAX_PREVIEW_STRING_LENGTH = 80;

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
};

export const parseJson = (text: string | null): JsonParseResult => {
  if (!text) {
    return { success: false };
  }

  try {
    const value: unknown = JSON.parse(text);
    return isJsonValue(value) ? { success: true, value } : { success: false };
  } catch {
    return { success: false };
  }
};

export const formatResponseBody = (text: string | null): string => {
  const parsedJson = parseJson(text);
  return parsedJson.success ? JSON.stringify(parsedJson.value, null, 2) : (text ?? "(empty)");
};

const formatPropertyName = (name: string): string => {
  if (/^[A-Za-z_$][\w$]*$/.test(name)) {
    return name;
  }

  return JSON.stringify(name);
};

const formatPrimitivePreview = (value: JsonPrimitive): string => {
  if (typeof value !== "string") {
    return JSON.stringify(value);
  }

  const previewValue =
    value.length > MAX_PREVIEW_STRING_LENGTH
      ? `${value.slice(0, MAX_PREVIEW_STRING_LENGTH)}...`
      : value;
  return JSON.stringify(previewValue);
};

export const getJsonPreviewSummary = (value: JsonValue): string => {
  if (Array.isArray(value)) {
    const previewItems = value
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((item) => getJsonPreviewSummary(item));
    const suffix = value.length > MAX_PREVIEW_ITEMS ? ", ..." : "";
    return `[${previewItems.join(", ")}${suffix}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    const previewProperties = entries
      .slice(0, MAX_PREVIEW_PROPERTIES)
      .map(([key, item]) => `${formatPropertyName(key)}: ${getJsonPreviewSummary(item)}`);
    const suffix = entries.length > MAX_PREVIEW_PROPERTIES ? ", ..." : "";
    return `{${previewProperties.join(", ")}${suffix}}`;
  }

  return formatPrimitivePreview(value);
};
