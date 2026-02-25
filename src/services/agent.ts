import type { AgentChatRequest, AgentChatResponse } from "../types/api";
import { createApiClient } from "./http";

const agentBaseUrl =
  import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8084";

const client = createApiClient(agentBaseUrl);

export const sendChat = async (payload: AgentChatRequest) => {
  return client.request<AgentChatResponse>("/api/agent/chat", {
    method: "POST",
    body: payload,
  });
};

export const createSession = async (userId?: string) => {
  return client.request<{ sessionId: string }>("/api/agent/session", {
    method: "POST",
    body: userId ? { userId } : {},
  });
};

export const getSession = async (sessionId: string) => {
  return client.request<{ sessionId: string; userId?: string }>(
    `/api/agent/session/${sessionId}`
  );
};

export const deleteSession = async (sessionId: string) => {
  return client.request<void>(`/api/agent/session/${sessionId}`, {
    method: "DELETE",
  });
};
