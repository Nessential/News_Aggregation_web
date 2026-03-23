<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import type { ChatMessage } from "../types/news";
import type {
  AgentBudgetSnapshot,
  AgentChatResponse,
  AgentHistoryMessage,
  AgentQuotaEntry,
  AgentRelatedNews,
  FeatureQuotaMap,
} from "../types/api";
import { APP_CONFIG } from "../config/app";
import MarkdownRenderer from "./MarkdownRenderer.vue";
import {
  getHistory,
  getHistoryByUser,
  getRecentSessions,
  getSession,
  sendChat,
} from "../services/agent";
import { getMyQuota } from "../services/auth";
import { ApiError, formatApiError } from "../services/http";

const emit = defineEmits<{
  (event: "select-article", articleId: number): void;
  (event: "require-login"): void;
  (event: "auth-expired"): void;
}>();

const props = defineProps<{
  activeArticleId?: string | null;
  currentUserId?: string | null;
  initialFeatureQuotas?: FeatureQuotaMap | null;
}>();

const draft = ref<string>("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref<boolean>(false);
const sendError = ref<string>("");
const historyError = ref<string>("");
const sessionId = ref<string | null>(null);
const isHistoryLoading = ref<boolean>(false);
const debugEvents = ref<string[]>([]);
const quotaItems = ref<AgentQuotaEntry[]>([]);
const messagesContainerRef = ref<HTMLElement | null>(null);
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = APP_CONFIG.timeout.chatPollMs;
const SESSION_STORAGE_KEY = "news_agent_session_id";
const SESSION_STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const scrollMessagesToBottom = (behavior: ScrollBehavior = "smooth") => {
  const container = messagesContainerRef.value;
  if (!container) return;
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
};

const appendMessage = (message: ChatMessage) => {
  messages.value = [...messages.value, message];
  void nextTick(() => scrollMessagesToBottom("smooth"));
};

const replaceMessages = (nextMessages: ChatMessage[]) => {
  messages.value = nextMessages;
  void nextTick(() => scrollMessagesToBottom("auto"));
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

const parseQuotaNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const buildQuotaLabel = (feature: string) => {
  const normalized = feature.replace(/[-_]/g, " ").trim();
  if (!normalized) return "Quota";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeQuotaEntry = (value: unknown): AgentQuotaEntry | null => {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const feature =
    typeof raw.feature === "string"
      ? raw.feature
      : typeof raw.key === "string"
        ? raw.key
        : typeof raw.name === "string"
          ? raw.name
          : "";

  if (!feature) return null;

  return {
    feature,
    remaining:
      parseQuotaNumber(raw.remaining) ??
      parseQuotaNumber(raw.remainingBudget) ??
      parseQuotaNumber(raw.left),
    total: parseQuotaNumber(raw.total) ?? parseQuotaNumber(raw.limit),
    label: typeof raw.label === "string" ? raw.label : buildQuotaLabel(feature),
    unit: typeof raw.unit === "string" ? raw.unit : "left",
  };
};

const normalizeQuotaItems = (payload?: AgentBudgetSnapshot | null) => {
  if (!payload || typeof payload !== "object") return [];

  const entries: AgentQuotaEntry[] = [];
  const rawEntries = Array.isArray(payload.quotas) ? payload.quotas : [];
  for (const item of rawEntries) {
    const normalized = normalizeQuotaEntry(item);
    if (normalized) {
      entries.push(normalized);
    }
  }

  const remainingBudget = parseQuotaNumber(payload.remainingBudget);
  if (remainingBudget !== null && !entries.some((entry) => entry.feature === "chat")) {
    entries.unshift({
      feature: "chat",
      remaining: remainingBudget,
      label: "Chat",
      unit: "left",
    });
  }

  return entries.filter((entry) => entry.remaining !== null);
};

const normalizeFeatureQuotaItems = (featureQuotas?: FeatureQuotaMap | null) => {
  if (!featureQuotas || typeof featureQuotas !== "object") return [];
  const entries: AgentQuotaEntry[] = [];
  const pairs = Object.entries(featureQuotas);
  for (const [featureKey, item] of pairs) {
    if (!item || typeof item !== "object") continue;
    const featureCode = item.featureCode || featureKey || "feature";
    entries.push({
      feature: featureCode,
      remaining: parseQuotaNumber(item.remainingCount),
      total: parseQuotaNumber(item.dailyLimit),
      label: buildQuotaLabel(featureCode),
      unit: "left",
    });
  }
  return entries.filter((entry) => entry.remaining !== null);
};

const setQuotaItemsFromLegacy = (payload?: AgentBudgetSnapshot | null, clear = false) => {
  const nextItems = normalizeQuotaItems(payload);
  if (nextItems.length || clear) {
    quotaItems.value = nextItems;
  }
};

const setQuotaItemsFromFeatureQuotas = (
  featureQuotas?: FeatureQuotaMap | null,
  clear = false
) => {
  const nextItems = normalizeFeatureQuotaItems(featureQuotas);
  if (nextItems.length || clear) {
    quotaItems.value = nextItems;
  }
};

const ensureChatQuotaPlaceholder = () => {
  if (!props.currentUserId) return;
  if (quotaItems.value.some((item) => item.feature === "chat")) return;
  quotaItems.value = [
    ...quotaItems.value,
    {
      feature: "chat",
      remaining: null,
      label: "Chat",
      unit: "left",
    },
  ];
};

const decrementChatQuotaLocally = () => {
  let updated = false;
  quotaItems.value = quotaItems.value.map((item) => {
    if (item.feature !== "chat") return item;
    updated = true;
    const remaining =
      typeof item.remaining === "number" && Number.isFinite(item.remaining)
        ? Math.max(0, item.remaining - 1)
        : item.remaining;
    return { ...item, remaining };
  });
  if (updated) {
    pushDebug("Quota: chat remaining decremented locally");
  }
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
  markdownContent: message,
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
    case "FEATURE_QUOTA_EXCEEDED":
      return "Today's chat quota is exhausted.";
    case "BUDGET_EXHAUSTED":
      return "Chat quota exhausted. Please try again later.";
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
  markdownContent: message.role === 1 ? message.content : undefined,
  time: formatHistoryTime(message.createdAt),
  answerItems: [],
});

const loadMyQuota = async () => {
  if (!props.currentUserId) return;
  try {
    const response = await getMyQuota();
    setQuotaItemsFromFeatureQuotas(response.featureQuotas);
    pushDebug("Response: /api/user/auth/quota/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setQuotaItemsFromFeatureQuotas(undefined, true);
      emit("auth-expired");
      emit("require-login");
      return;
    }
    pushDebug(`Error: /api/user/auth/quota/me ${formatApiError(error)}`);
  }
};

const loadSessionBudget = async (existingSessionId: string) => {
  try {
    const response = await getSession(existingSessionId);
    setQuotaItemsFromLegacy(response.budget);
    pushDebug(`Response: /api/agent/session/${existingSessionId} budget loaded`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSessionCache(props.currentUserId);
      sessionId.value = null;
      setQuotaItemsFromFeatureQuotas(undefined, true);
      emit("auth-expired");
      emit("require-login");
      return;
    }

    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return;
    }

    pushDebug(`Error: /api/agent/session/${existingSessionId} ${formatApiError(error)}`);
  }
};

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
    await loadSessionBudget(response.sessionId);
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
      setQuotaItemsFromFeatureQuotas(undefined, true);
      emit("auth-expired");
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
    if (latestSessionId) {
      await loadSessionBudget(latestSessionId);
    }
    pushDebug(`Response: /api/agent/history/user/${userId} count=${response.count}`);
  } catch (error) {
    historyError.value = formatApiError(error);
    if (error instanceof ApiError && error.status === 401) {
      historyError.value = "Please log in to load conversation history.";
      setQuotaItemsFromFeatureQuotas(undefined, true);
      emit("auth-expired");
      emit("require-login");
    }
    pushDebug(`Error: /api/agent/history/user/${userId} ${historyError.value}`);
  } finally {
    isHistoryLoading.value = false;
  }
};

const loadRecentSessionForUser = async (userId: string) => {
  historyError.value = "";
  pushDebug("Request: GET /api/agent/session/recent?limit=1");

  try {
    const sessions = await getRecentSessions({ limit: 1 });
    const recentSessionId = sessions[0]?.sessionId ?? null;
    pushDebug(`Response: /api/agent/session/recent count=${sessions.length}`);

    if (!recentSessionId) {
      sessionId.value = null;
      persistSessionId(null);
      replaceMessages([]);
      return;
    }

    sessionId.value = recentSessionId;
    persistSessionId(recentSessionId);
    await loadHistory(recentSessionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      historyError.value = "Please log in to load conversation history.";
      setQuotaItemsFromFeatureQuotas(undefined, true);
      emit("auth-expired");
      emit("require-login");
      return;
    }

    pushDebug(`Error: /api/agent/session/recent ${formatApiError(error)}`);
    await loadUserHistory(userId);
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
    if (response.featureQuotas) {
      setQuotaItemsFromFeatureQuotas(response.featureQuotas);
    } else {
      setQuotaItemsFromLegacy(response.metadata);
    }
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

const buildAnswerFromItems = (response: AgentChatResponse) => {
  const texts = (response.answerItems ?? [])
    .map((item) => item.text?.trim())
    .filter((text): text is string => Boolean(text));
  return texts.join("\n\n");
};

const buildAssistantMessage = (response: AgentChatResponse): ChatMessage => ({
  id: `assistant-${Date.now()}`,
  role: "assistant",
  content: buildAnswerFromItems(response) || response.answerMarkdown || response.answer || "No answer returned.",
  markdownContent: response.answerMarkdown || response.answer || "",
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
    if (!response.featureQuotas && !response.metadata?.remainingBudget) {
      decrementChatQuotaLocally();
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
        setQuotaItemsFromFeatureQuotas(undefined, true);
        emit("auth-expired");
        emit("require-login");
      } else if (error.status === 403 || errorCode === "SESSION_FORBIDDEN") {
        clearSessionCache(props.currentUserId);
        sessionId.value = null;
        sendError.value = "You do not have access to this session. Please start a new conversation.";
      } else if (error.status === 404) {
        clearSessionCache(props.currentUserId);
        sessionId.value = null;
        sendError.value = "Session expired or no longer exists. Please start a new conversation.";
      } else if (error.status === 429 || errorCode === "FEATURE_QUOTA_EXCEEDED") {
        sendError.value = "Today's chat quota is exhausted.";
      } else if (errorCode === "SESSION_BUSY") {
        sendError.value = "Previous turn is still running. Please wait.";
      } else if (errorCode === "INTERNAL_ERROR") {
        sendError.value = "Internal service error. Please try again later.";
      } else {
        sendError.value = formatApiError(error);
      }
      if (errorDetails) {
        if (errorDetails.featureQuotas) {
          setQuotaItemsFromFeatureQuotas(errorDetails.featureQuotas);
        } else {
          setQuotaItemsFromLegacy(errorDetails.metadata);
        }
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
  if (props.currentUserId && props.initialFeatureQuotas) {
    setQuotaItemsFromFeatureQuotas(props.initialFeatureQuotas);
  }
  ensureChatQuotaPlaceholder();
  if (!props.currentUserId) return;
  void loadMyQuota();
  void loadRecentSessionForUser(props.currentUserId);
});

watch(
  () => props.initialFeatureQuotas,
  (featureQuotas) => {
    if (!props.currentUserId) return;
    setQuotaItemsFromFeatureQuotas(featureQuotas);
    ensureChatQuotaPlaceholder();
  }
);

watch(
  () => props.currentUserId,
  (userId, previousUserId) => {
    if (previousUserId && previousUserId !== userId) {
      clearSessionCache(previousUserId);
      setQuotaItemsFromFeatureQuotas(undefined, true);
    }

    if (userId && userId !== previousUserId) {
      ensureChatQuotaPlaceholder();
      void loadMyQuota();
      void loadRecentSessionForUser(userId);
      return;
    }

    if (!userId && previousUserId) {
      sessionId.value = null;
      replaceMessages([]);
      historyError.value = "";
      sendError.value = "";
      setQuotaItemsFromFeatureQuotas(undefined, true);
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
      <div class="chat-panel__status">
        <div v-if="currentUserId && quotaItems.length" class="quota-badges">
          <div v-for="quota in quotaItems" :key="quota.feature" class="quota-badge">
            <span class="quota-badge__label">
              {{ quota.label || buildQuotaLabel(quota.feature) }}
            </span>
            <span class="quota-badge__value">{{ quota.remaining ?? "--" }}</span>
            <span v-if="quota.unit" class="quota-badge__unit">{{ quota.unit }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-slate-400">
          <span class="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span class="text-xs font-semibold">Live</span>
        </div>
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
      <div ref="messagesContainerRef" class="chat-panel__messages">
        <div
          v-for="message in messages"
          :key="message.id"
          class="chat-bubble"
          :class="message.role"
        >
          <template v-if="message.role === 'assistant'">
            <template v-if="message.answerItems?.length">
              <div
                v-for="(item, index) in message.answerItems"
                :key="`${message.id}-${index}`"
                class="assistant-answer-block"
              >
                <MarkdownRenderer
                  v-if="item.text?.trim()"
                  :content="item.text"
                />
                <p v-else class="assistant-answer-text">{{ item.text }}</p>
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
              <MarkdownRenderer
                v-if="message.markdownContent?.trim()"
                :content="message.markdownContent"
              />
              <p v-else>{{ message.content }}</p>
            </template>
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
