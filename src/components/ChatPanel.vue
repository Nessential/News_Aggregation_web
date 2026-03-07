<script setup lang="ts">
import { ref } from "vue";
import type { ChatMessage } from "../types/news";
import type { AgentChatResponse, AgentRelatedNews } from "../types/api";
import { APP_CONFIG } from "../config/app";
import { sendChat } from "../services/agent";
import { ApiError, formatApiError } from "../services/http";

const emit = defineEmits<{
  (event: "select-article", articleId: number): void;
}>();

const props = defineProps<{
  activeArticleId?: string | null;
}>();

const draft = ref<string>("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref<boolean>(false);
const sendError = ref<string>("");
const sessionId = ref<string | null>(null);
const debugEvents = ref<string[]>([]);
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = APP_CONFIG.timeout.chatPollMs;

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const appendMessage = (message: ChatMessage) => {
  messages.value = [...messages.value, message];
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
  if (response.answer?.trim()) return response.answer;
  switch (response.errorCode) {
    case "SESSION_BUSY":
      return "Previous turn is still running. Please wait.";
    case "INTERNAL_ERROR":
      return "Internal service error. Please try again later.";
    default:
      return "Chat request failed.";
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
    sessionId.value = response.sessionId;

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
      if (errorCode === "SESSION_BUSY") {
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
            placeholder="Type a message..."
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
