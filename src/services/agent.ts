import { APP_CONFIG } from "../config/app";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentHistoryResponse,
  AgentSessionState,
  AgentUserHistoryResponse,
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

export const createSession = async () => {
  return client.request<{ sessionId: string }>("/api/agent/session", {
    method: "POST",
    body: {},
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

export const getHistory = async (
  sessionId: string,
  params?: { turnId?: string; limit?: number }
) => {
  const query = new URLSearchParams();
  if (params?.turnId) query.set("turnId", params.turnId);
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  return client.request<AgentHistoryResponse>(
    `/api/agent/history/${sessionId}${queryString ? `?${queryString}` : ""}`
  );
};

export const getHistoryByUser = async (
  userId: string,
  params?: { pageNum?: number; pageSize?: number }
) => {
  const query = new URLSearchParams();
  if (params?.pageNum) query.set("pageNum", String(params.pageNum));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const queryString = query.toString();

  return client.request<AgentUserHistoryResponse>(
    `/api/agent/history/user/${encodeURIComponent(userId)}${queryString ? `?${queryString}` : ""}`
  );
};
