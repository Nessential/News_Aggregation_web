<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { ChatMessage } from "../types/news";
import type {
  AgentChatResponse,
  AgentHistoryMessage,
  AgentRelatedNews,
} from "../types/api";
import { APP_CONFIG } from "../config/app";
import { getHistory, getHistoryByUser, sendChat } from "../services/agent";
import { ApiError, formatApiError } from "../services/http";

const emit = defineEmits<{
  (event: "select-article", articleId: number): void;
  (event: "require-login"): void;
}>();

const props = defineProps<{
  activeArticleId?: string | null;
  currentUserId?: string | null;
}>();

const draft = ref<string>("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref<boolean>(false);
const sendError = ref<string>("");
const historyError = ref<string>("");
const sessionId = ref<string | null>(null);
const isHistoryLoading = ref<boolean>(false);
const debugEvents = ref<string[]>([]);
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = APP_CONFIG.timeout.chatPollMs;
const SESSION_STORAGE_KEY = "news_agent_session_id";
const SESSION_STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const appendMessage = (message: ChatMessage) => {
  messages.value = [...messages.value, message];
};

const replaceMessages = (nextMessages: ChatMessage[]) => {
  messages.value = nextMessages;
};

const pushDebug = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  debugEvents.value = [`[${timestamp}] ${message}`, ...debugEvents.value].slice(0, 8);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const createUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const random = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}${random}`.slice(0, 32);
};

const formatHistoryTime = (value?: string) => {
  if (!value) return formatTime(new Date());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || formatTime(new Date());
  return formatTime(date);
};

const getSessionStorageKey = (userId?: string | null) => {
  return userId ? `${SESSION_STORAGE_KEY}_${userId}` : SESSION_STORAGE_KEY;
};

const clearSessionCache = (userId?: string | null) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getSessionStorageKey(userId));
};

const persistSessionId = (value?: string | null) => {
  if (typeof window === "undefined") return;
  const storageKey = getSessionStorageKey(props.currentUserId);
  if (!value) {
    localStorage.removeItem(storageKey);
    return;
  }
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      sessionId: value,
      expiresAt: Date.now() + SESSION_STORAGE_TTL_MS,
    })
  );
};

const restoreSessionId = () => {
  if (typeof window === "undefined") return null;
  const storageKey = getSessionStorageKey(props.currentUserId);
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as
      | string
      | {
          sessionId?: string;
          expiresAt?: number;
        };

    if (typeof parsed === "string") {
      persistSessionId(parsed);
      return parsed;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.sessionId === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      if (parsed.expiresAt <= Date.now()) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return parsed.sessionId;
    }
  } catch {
    if (typeof raw === "string" && raw.trim()) {
      persistSessionId(raw);
      return raw;
    }
  }

  localStorage.removeItem(storageKey);
  return null;
};

const getErrorCode = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return undefined;
  if ("errorCode" in payload && typeof payload.errorCode === "string") {
    return payload.errorCode;
  }
  if ("code" in payload && typeof payload.code === "string") {
    return payload.code;
  }
  return undefined;
};

const buildAssistantFallback = (message: string): ChatMessage => ({
  id: `assistant-${Date.now()}`,
  role: "assistant",
  content: message,
  time: formatTime(new Date()),
  answerItems: [],
});

const resolveErrorMessage = (response: AgentChatResponse) => {
  if (response.needsClarification && response.clarificationPrompt?.trim()) {
    return response.clarificationPrompt;
  }
  if (response.answer?.trim()) return response.answer;
  if (response.errorCode === "SESSION_FORBIDDEN") {
    return "You do not have access to this session.";
  }
  switch (response.errorCode) {
    case "SESSION_BUSY":
      return "Previous turn is still running. Please wait.";
    case "INTERNAL_ERROR":
      return "Internal service error. Please try again later.";
    default:
      return "Chat request failed.";
  }
};

const mapHistoryMessage = (message: AgentHistoryMessage): ChatMessage => ({
  id: `history-${message.messageId}`,
  role: message.role === 0 ? "user" : "assistant",
  content: message.content,
  time: formatHistoryTime(message.createdAt),
  answerItems: [],
});

const loadHistory = async (existingSessionId: string) => {
  isHistoryLoading.value = true;
  historyError.value = "";
  pushDebug(`Request: GET /api/agent/history/${existingSessionId}?limit=50`);

  try {
    const response = await getHistory(existingSessionId, { limit: 50 });
    sessionId.value = response.sessionId;
    persistSessionId(response.sessionId);
    replaceMessages(
      [...response.messages]
        .sort((a, b) => {
          if (a.turnId === b.turnId) {
            return a.seqNo - b.seqNo;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
        .map(mapHistoryMessage)
    );
    pushDebug(`Response: /api/agent/history/${existingSessionId} count=${response.count}`);
  } catch (error) {
    historyError.value = formatApiError(error);
    if (error instanceof ApiError && error.status === 404) {
      clearSessionCache(props.currentUserId);
      sessionId.value = null;
      historyError.value = "Session expired or no longer exists. Please start a new conversation.";
    } else if (error instanceof ApiError && error.status === 401) {
      clearSessionCache(props.currentUserId);
      sessionId.value = null;
      historyError.value = "Please log in to load conversation history.";
      emit("require-login");
    } else if (error instanceof ApiError && error.status === 403) {
      clearSessionCache(props.currentUserId);
      sessionId.value = null;
      historyError.value = "You do not have access to this session.";
    }
    pushDebug(`Error: /api/agent/history/${existingSessionId} ${historyError.value}`);
  } finally {
    isHistoryLoading.value = false;
  }
};

const loadUserHistory = async (userId: string) => {
  isHistoryLoading.value = true;
  historyError.value = "";
  pushDebug(`Request: GET /api/agent/history/user/${userId}?pageNum=1&pageSize=50`);

  try {
    const response = await getHistoryByUser(userId, { pageNum: 1, pageSize: 50 });
    const orderedMessages = [...response.messages].sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.turnId === b.turnId) return a.seqNo - b.seqNo;
      return 0;
    });

    replaceMessages(orderedMessages.map(mapHistoryMessage));
    const latestSessionId = orderedMessages[orderedMessages.length - 1]?.sessionId ?? null;
    sessionId.value = latestSessionId;
    persistSessionId(latestSessionId);
    pushDebug(`Response: /api/agent/history/user/${userId} count=${response.count}`);
  } catch (error) {
    historyError.value = formatApiError(error);
    if (error instanceof ApiError && error.status === 401) {
      historyError.value = "Please log in to load conversation history.";
      emit("require-login");
    }
    pushDebug(`Error: /api/agent/history/user/${userId} ${historyError.value}`);
  } finally {
    isHistoryLoading.value = false;
  }
};

const pollChatUntilDone = async (
  payload: {
    sessionId?: string;
    turnId: string;
    idempotencyKey: string;
    query: string;
  },
  startedAt: number
) => {
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await sendChat(payload);
    if (response.sessionId) {
      sessionId.value = response.sessionId;
    }

    if (response.turnStatus === "DONE" && !response.errorCode) {
      return response;
    }

    if (
      response.errorCode === "IDEMPOTENCY_IN_PROGRESS" ||
      response.turnStatus === "RUNNING"
    ) {
      pushDebug("Polling: turn still running");
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (response.errorCode === "SESSION_BUSY" || response.turnStatus === "BUSY") {
      throw new ApiError("Previous turn is still running. Please wait.", {
        code: "SESSION_BUSY",
        details: response,
      });
    }

    if (response.turnStatus === "FAILED" || response.errorCode) {
      throw new ApiError(response.answer || "Chat request failed", {
        code: response.errorCode ?? "FAILED",
        details: response,
      });
    }

    return response;
  }

  throw new ApiError("Chat request timed out. Please try again shortly.", {
    code: "POLL_TIMEOUT",
  });
};

const getEvidenceList = (message: ChatMessage, index: number): AgentRelatedNews[] => {
  if (message.role !== "assistant") return [];
  return message.answerItems?.[index]?.relatedNews ?? [];
};

const handleEvidenceClick = (articleId?: number) => {
  if (!articleId) return;
  emit("select-article", articleId);
};

const isEvidenceActive = (articleId?: number) => {
  if (!articleId || !props.activeArticleId) return false;
  return String(articleId) === props.activeArticleId;
};

const buildAssistantMessage = (response: AgentChatResponse): ChatMessage => ({
  id: `assistant-${Date.now()}`,
  role: "assistant",
  content: response.answer || "No answer returned.",
  time: formatTime(new Date()),
  answerItems: response.answerItems ?? [],
});

const handleSubmit = async () => {
  const text = draft.value.trim();
  if (!text || isSending.value) return;
  if (!props.currentUserId) {
    sendError.value = "Please log in before starting a conversation.";
    emit("require-login");
    return;
  }

  sendError.value = "";
  const turnId = createUuid();
  const idempotencyKey = createUuid();
  pushDebug(`Request: POST /api/agent/chat turnId=${turnId}`);
  const timestamp = formatTime(new Date());
  appendMessage({
    id: `user-${Date.now()}`,
    role: "user",
    content: text,
    time: timestamp,
  });
  draft.value = "";
  isSending.value = true;

  try {
    const payload = {
      sessionId: sessionId.value ?? undefined,
      turnId,
      idempotencyKey,
      query: text,
    };
    const response = await pollChatUntilDone(payload, Date.now());
    if (response.sessionId) {
      persistSessionId(response.sessionId);
    }
    pushDebug(
      `Response: /api/agent/chat session=${response.sessionId} turnStatus=${response.turnStatus ?? "DONE"}`
    );
    appendMessage(buildAssistantMessage(response));
  } catch (error) {
    let assistantFallback = "Sorry, I couldn't reach the assistant service.";
    if (error instanceof ApiError) {
      const errorDetails =
        error.details && typeof error.details === "object"
          ? (error.details as AgentChatResponse)
          : undefined;
      const errorCode = getErrorCode(error.details) ?? error.code;
      if (error.status === 401 || errorCode === "UNAUTHORIZED") {
        sendError.value = "Please log in before starting a conversation.";
        emit("require-login");
      } else if (error.status === 403 || errorCode === "SESSION_FORBIDDEN") {
        clearSessionCache(props.currentUserId);
        sessionId.value = null;
        sendError.value = "You do not have access to this session. Please start a new conversation.";
      } else if (error.status === 404) {
        clearSessionCache(props.currentUserId);
        sessionId.value = null;
        sendError.value = "Session expired or no longer exists. Please start a new conversation.";
      } else if (errorCode === "SESSION_BUSY") {
        sendError.value = "Previous turn is still running. Please wait.";
      } else if (errorCode === "INTERNAL_ERROR") {
        sendError.value = "Internal service error. Please try again later.";
      } else {
        sendError.value = formatApiError(error);
      }
      if (errorDetails) {
        assistantFallback = resolveErrorMessage(errorDetails);
      } else if (sendError.value) {
        assistantFallback = sendError.value;
      }
    } else {
      sendError.value = formatApiError(error);
      assistantFallback = sendError.value;
    }
    pushDebug(`Error: /api/agent/chat ${sendError.value}`);
    appendMessage(buildAssistantFallback(assistantFallback));
  } finally {
    isSending.value = false;
  }
};

onMounted(() => {
  if (!props.currentUserId) return;
  void loadUserHistory(props.currentUserId);
});

watch(
  () => props.currentUserId,
  (userId, previousUserId) => {
    if (previousUserId && previousUserId !== userId) {
      clearSessionCache(previousUserId);
    }

    if (userId && userId !== previousUserId) {
      void loadUserHistory(userId);
      return;
    }

    if (!userId && previousUserId) {
      sessionId.value = null;
      replaceMessages([]);
      historyError.value = "";
      sendError.value = "";
    }
  }
);
</script>

<template>
  <aside class="panel chat-panel p-5">
    <header class="flex items-center justify-between border-b border-slate-200 pb-3">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Assistant</p>
        <h2 class="section-title">Chat with AI Assistant</h2>
      </div>
      <div class="flex items-center gap-2 text-slate-400">
        <span class="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
        <span class="text-xs font-semibold">Live</span>
      </div>
    </header>

    <div class="chat-panel__body">
      <div class="detail-panel detail-panel--chat">
        <p class="detail-panel__eyebrow">Debug</p>
        <ul class="debug-list">
          <li v-for="event in debugEvents" :key="event">{{ event }}</li>
        </ul>
      </div>
      <div v-if="isHistoryLoading" class="detail-panel detail-panel--chat">
        <p class="detail-panel__summary">Loading recent conversation...</p>
      </div>
      <div v-else-if="historyError" class="detail-panel detail-panel--chat">
        <p class="detail-panel__title">History unavailable</p>
        <p class="detail-panel__summary">{{ historyError }}</p>
      </div>
      <div v-if="!currentUserId" class="detail-panel detail-panel--chat">
        <p class="detail-panel__title">Login required</p>
        <p class="detail-panel__summary">
          Chat功能需要先登录，登录后才能查看历史会话并发送问题。
        </p>
      </div>
      <div v-if="sendError" class="detail-panel detail-panel--chat">
        <p class="detail-panel__title">Chat error</p>
        <p class="detail-panel__summary">{{ sendError }}</p>
      </div>
      <div class="chat-panel__messages">
        <div
          v-for="message in messages"
          :key="message.id"
          class="chat-bubble"
          :class="message.role"
        >
          <template v-if="message.role === 'assistant' && message.answerItems?.length">
            <div
              v-for="(item, index) in message.answerItems"
              :key="`${message.id}-${index}`"
              class="assistant-answer-block"
            >
              <p class="assistant-answer-text">{{ item.text }}</p>
              <div v-if="getEvidenceList(message, index).length" class="evidence-strip">
                <button
                  v-for="evidence in getEvidenceList(message, index)"
                  :key="`${message.id}-${index}-${evidence.articleId}`"
                  type="button"
                  class="evidence-chip"
                  :class="{ 'is-active': isEvidenceActive(evidence.articleId) }"
                  @click="handleEvidenceClick(evidence.articleId)"
                >
                  <img
                    v-if="evidence.imageUrl"
                    :src="evidence.imageUrl"
                    :alt="evidence.title || 'Evidence article'"
                    class="evidence-chip__image"
                  />
                  <div v-else class="evidence-chip__placeholder" aria-hidden="true">
                    {{ index + 1 }}
                  </div>
                  <div class="evidence-chip__body">
                    <p class="evidence-chip__title">
                      {{ evidence.title || "Untitled article" }}
                    </p>
                    <p v-if="evidence.source || evidence.publishedAt" class="evidence-chip__meta">
                      {{ [evidence.source, evidence.publishedAt].filter(Boolean).join(" · ") }}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <p>{{ message.content }}</p>
          </template>
          <p class="mt-2 text-xs opacity-70">{{ message.time }}</p>
        </div>
      </div>

      <form class="chat-panel__form" @submit.prevent="handleSubmit">
        <div class="input-shell">
          <input
            v-model="draft"
            type="text"
            :placeholder="currentUserId ? 'Type a message...' : 'Login required for chat'"
            :disabled="isSending"
          />
          <button type="submit" :disabled="isSending || !draft.trim()">
            {{ isSending ? "Sending..." : "Send" }}
          </button>
        </div>
      </form>
    </div>
  </aside>
</template>

