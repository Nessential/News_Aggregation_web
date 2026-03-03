<script setup lang="ts">
import { ref } from "vue";
import type { ChatMessage } from "../types/news";
import type { AgentChatResponse } from "../types/api";
import { sendChat } from "../services/agent";
import { ApiError, formatApiError } from "../services/http";

const draft = ref<string>("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref<boolean>(false);
const sendError = ref<string>("");
const sessionId = ref<string | null>(null);
const debugEvents = ref<string[]>([]);
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60000;

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
      throw new ApiError("上一条问答仍在处理中，请稍后再试。", {
        code: "SESSION_BUSY",
        details: response,
      });
    }

    if (response.turnStatus === "FAILED" || response.errorCode) {
      throw new ApiError(response.answer || "问答处理失败", {
        code: response.errorCode ?? "FAILED",
        details: response,
      });
    }

    return response;
  }

  throw new ApiError("问答处理中超时，请稍后重试。", { code: "POLL_TIMEOUT" });
};

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
    appendMessage({
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer || "No answer returned.",
      time: formatTime(new Date()),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errorCode = getErrorCode(error.details) ?? error.code;
      if (errorCode === "SESSION_BUSY") {
        sendError.value = "上一条问答仍在处理中，请稍后再试。";
      } else if (errorCode === "INTERNAL_ERROR") {
        sendError.value = "服务内部错误，请稍后重试。";
      } else {
        sendError.value = formatApiError(error);
      }
    } else {
      sendError.value = formatApiError(error);
    }
    pushDebug(`Error: /api/agent/chat ${sendError.value}`);
    appendMessage({
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "Sorry, I couldn't reach the assistant service.",
      time: formatTime(new Date()),
    });
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
          <p>{{ message.content }}</p>
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
