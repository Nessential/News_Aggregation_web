export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiClient {
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

const DEFAULT_TIMEOUT = 15000;

const buildUrl = (baseUrl: string, path: string) => {
  if (!baseUrl) return path;
  return baseUrl.replace(/\/$/, "") + path;
};

const safeParseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Request failed";
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if ("title" in payload && typeof payload.title === "string") {
    return payload.title;
  }

  return "Request failed";
};

const hasBusinessError = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return false;
  if ("success" in payload && payload.success === false) return true;
  if ("code" in payload && typeof payload.code === "string") return true;
  return false;
};

export const createApiClient = (baseUrl: string): ApiClient => {
  return {
    request: async <T>(path: string, options: RequestOptions = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? DEFAULT_TIMEOUT
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      const init: RequestInit = {
        method: options.method ?? "GET",
        headers,
        signal: controller.signal,
      };

      if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
      }

      try {
        const response = await fetch(buildUrl(baseUrl, path), init);
        const payload = await safeParseJson(response);

        if (!response.ok || hasBusinessError(payload)) {
          const message = extractErrorMessage(payload);
          const code =
            payload && typeof payload === "object" && "code" in payload
              ? String(payload.code)
              : undefined;
          throw new ApiError(message, {
            status: response.status,
            code,
            details: payload,
          });
        }

        return payload as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ApiError("Request timed out", { code: "TIMEOUT" });
        }

        throw new ApiError("Network error", { details: error });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

export const formatApiError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.details && typeof error.details === "object") {
      const entries = Object.entries(error.details).filter(
        ([, value]) => typeof value === "string"
      );
      if (entries.length > 0) {
        return entries.map(([key, value]) => `${key}: ${value}`).join("; ");
      }
    }
    return error.message || "Request failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
};
