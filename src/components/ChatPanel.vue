<script setup lang="ts">
import { ref } from "vue";
import { chatMessages } from "../data/mock";
import type { ChatMessage } from "../types/news";
import { sendChat } from "../services/agent";
import { formatApiError } from "../services/http";

const draft = ref<string>("");
const messages = ref<ChatMessage[]>([...chatMessages]);
const isSending = ref<boolean>(false);
const sendError = ref<string>("");
const sessionId = ref<string | null>(null);
const debugEvents = ref<string[]>([]);

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

const handleSubmit = async () => {
  const text = draft.value.trim();
  if (!text || isSending.value) return;

  sendError.value = "";
  pushDebug("Request: POST /api/agent/chat");
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
    const response = await sendChat({
      sessionId: sessionId.value ?? undefined,
      query: text,
    });
    sessionId.value = response.sessionId;
    pushDebug(`Response: /api/agent/chat session=${response.sessionId}`);
    appendMessage({
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer || "No answer returned.",
      time: formatTime(new Date()),
    });
  } catch (error) {
    sendError.value = formatApiError(error);
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
