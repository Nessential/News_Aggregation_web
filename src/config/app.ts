export interface AppRuntimeConfig {
  apiBaseUrls: {
    gateway: string;
    news: string;
    agent: string;
  };
  auth: {
    bearerToken: string;
    debugUserId: string;
  };
  timeout: {
    requestMs: number;
    chatPollMs: number;
  };
}

const DEFAULT_APP_CONFIG: AppRuntimeConfig = {
  apiBaseUrls: {
    gateway: "http://localhost:8088",
    news: "",
    agent: "",
  },
  auth: {
    bearerToken: "",
    debugUserId: "",
  },
  timeout: {
    requestMs: 15000,
    chatPollMs: 60000,
  },
};

export const APP_CONFIG: AppRuntimeConfig = {
  apiBaseUrls: { ...DEFAULT_APP_CONFIG.apiBaseUrls },
  auth: { ...DEFAULT_APP_CONFIG.auth },
  timeout: { ...DEFAULT_APP_CONFIG.timeout },
};

export const getApiBaseUrl = (service: "news" | "agent") => {
  return APP_CONFIG.apiBaseUrls[service] || APP_CONFIG.apiBaseUrls.gateway;
};

const mergeAppConfig = (partial?: Partial<AppRuntimeConfig>) => {
  if (!partial) return;

  Object.assign(APP_CONFIG.apiBaseUrls, partial.apiBaseUrls);
  Object.assign(APP_CONFIG.auth, partial.auth);
  Object.assign(APP_CONFIG.timeout, partial.timeout);
};

export const loadAppConfig = async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return APP_CONFIG;
    }

    const payload = (await response.json()) as Partial<AppRuntimeConfig>;
    mergeAppConfig(payload);
  } catch {
    return APP_CONFIG;
  }

  return APP_CONFIG;
};
