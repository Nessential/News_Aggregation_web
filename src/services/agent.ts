import { APP_CONFIG } from "../config/app";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentSessionState,
} from "../types/api";
import { createApiClient } from "./http";

const client = createApiClient(() => APP_CONFIG.apiBaseUrls.agent);

export const sendChat = async (payload: AgentChatRequest) => {
  return client.request<AgentChatResponse>("/api/agent/chat", {
    method: "POST",
    body: payload,
    allowedStatusCodes: [202, 409],
  });
};

export const createSession = async (userId?: string) => {
  return client.request<{ sessionId: string }>("/api/agent/session", {
    method: "POST",
    body: userId ? { userId } : {},
  });
};

export const getSession = async (sessionId: string) => {
  return client.request<AgentSessionState>(`/api/agent/session/${sessionId}`);
};

export const deleteSession = async (sessionId: string) => {
  return client.request<void>(`/api/agent/session/${sessionId}`, {
    method: "DELETE",
  });
};
