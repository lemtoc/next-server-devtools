import {
  recordNetworkError,
  recordNetworkRequest,
  recordNetworkResponse,
  type NetworkCaptureSource,
} from "./index";

export type OpenApiFetchMiddlewareOptions = {
  label?: string;
  source?: NetworkCaptureSource;
};

export type OpenApiFetchRequestParams = {
  id: string;
  request: Request;
  schemaPath?: string;
};

export type OpenApiFetchResponseParams = {
  id: string;
  response: Response;
};

export type OpenApiFetchErrorParams = {
  error: unknown;
  id: string;
};

export type OpenApiFetchDevtoolsMiddleware = {
  onError: (params: OpenApiFetchErrorParams) => void;
  onRequest: (params: OpenApiFetchRequestParams) => Promise<void>;
  onResponse: (params: OpenApiFetchResponseParams) => Promise<void>;
};

export const createOpenApiFetchMiddleware = (
  options: OpenApiFetchMiddlewareOptions = {},
): OpenApiFetchDevtoolsMiddleware => {
  const source = options.source ?? "server";

  return {
    onError(params) {
      recordNetworkError({ error: params.error, id: params.id });
    },
    async onRequest(params) {
      await recordNetworkRequest({
        id: params.id,
        label: params.schemaPath ?? options.label,
        request: params.request,
        source,
      });
    },
    async onResponse(params) {
      await recordNetworkResponse({
        id: params.id,
        response: params.response,
      });
    },
  };
};
