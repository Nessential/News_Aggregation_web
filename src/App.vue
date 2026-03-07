<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { topStories } from "./data/mock";
import type { Story } from "./types/news";
import type { ArticleDetailResponse, ArticleListItem, UserAuthInfo } from "./types/api";
import SidebarNav from "./components/SidebarNav.vue";
import TopStories from "./components/TopStories.vue";
import NewsDetailPanel from "./components/NewsDetailPanel.vue";
import ChatPanel from "./components/ChatPanel.vue";
import { fetchArticleDetail, fetchArticles } from "./services/news";
import { formatApiError } from "./services/http";
import { loginBySms, sendSmsCode } from "./services/auth";

const fallbackStories = topStories;
const defaultStory = fallbackStories[0]!;

const stories = ref<Story[]>(fallbackStories);
const selectedId = ref<string>(defaultStory.id);
const isLoading = ref<boolean>(false);
const isDetailLoading = ref<boolean>(false);
const loadError = ref<string>("");
const detailError = ref<string>("");
const dataSource = ref<"live" | "mock" | "loading">("mock");
const debugEvents = ref<string[]>([]);

const currentUser = ref<UserAuthInfo | null>(null);
const showLoginModal = ref<boolean>(false);
const showUserMenu = ref<boolean>(false);
const phoneInput = ref<string>("");
const codeInput = ref<string>("");
const isSendingCode = ref<boolean>(false);
const isLoggingIn = ref<boolean>(false);
const authError = ref<string>("");
const authHint = ref<string>("");
const resendCountdown = ref<number>(0);

const preferredLang = ref<string>(
  typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh" : "en"
);

const USER_STORAGE_KEY = "news_user_auth";
let resendTimer: ReturnType<typeof setInterval> | null = null;

const selectedStory = computed<Story>(() => {
  return stories.value.find((story) => story.id === selectedId.value) ?? defaultStory;
});

const formatPublishedAt = (article: { publishedAt?: string; publicationTime?: number }) => {
  if (article.publishedAt) return `Published ${article.publishedAt}`;
  if (article.publicationTime) {
    const date = new Date(article.publicationTime);
    if (!Number.isNaN(date.getTime())) {
      return `Published ${date.toLocaleString()}`;
    }
  }
  return "Recently updated";
};

const mapListItemToStory = (item: ArticleListItem, index: number): Story => {
  const fallbackImage = fallbackStories[index % fallbackStories.length]?.image ?? "";
  return {
    id: String(item.id),
    title: item.title,
    summary: item.summary,
    image: item.imageUrl ?? fallbackImage,
    updatedAt: formatPublishedAt(item),
    detailSummary: item.summary,
    highlights: [],
    source: item.source,
    link: item.link,
    publishedAt: item.publishedAt,
  };
};

const mapDetailToStory = (detail: ArticleDetailResponse): Story => {
  const existing = stories.value.find((story) => story.id === String(detail.id));
  const fallbackImage = existing?.image ?? fallbackStories[0]?.image ?? "";
  return {
    id: String(detail.id),
    title: detail.title || existing?.title || "Untitled article",
    summary: detail.summary || existing?.summary || "",
    image: detail.imageUrl ?? fallbackImage,
    updatedAt: formatPublishedAt(detail),
    detailSummary: detail.content ?? detail.summary ?? existing?.detailSummary ?? "",
    highlights: existing?.highlights ?? [],
    source: detail.source ?? existing?.source,
    link: detail.link ?? existing?.link,
    publishedAt: detail.publishedAt ?? existing?.publishedAt,
    content: detail.content ?? existing?.content,
  };
};

const isNumericId = (id: string) => Number.isFinite(Number(id));

const pushDebug = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  debugEvents.value = [`[${timestamp}] ${message}`, ...debugEvents.value].slice(0, 8);
};

const isValidPhone = (phone: string) => /^1\d{10}$/.test(phone);
const isValidCode = (code: string) => /^\d{4,8}$/.test(code);

const clearResendTimer = () => {
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
};

const startResendCountdown = (seconds: number) => {
  clearResendTimer();
  resendCountdown.value = Math.max(0, seconds);
  if (resendCountdown.value <= 0) return;

  resendTimer = setInterval(() => {
    if (resendCountdown.value <= 1) {
      clearResendTimer();
      resendCountdown.value = 0;
      return;
    }
    resendCountdown.value -= 1;
  }, 1000);
};

const saveUser = (user: UserAuthInfo | null) => {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

const restoreUser = () => {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as UserAuthInfo;
    if (parsed && typeof parsed.username === "string" && typeof parsed.phone === "string") {
      currentUser.value = parsed;
    }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
};

const openLoginModal = () => {
  showUserMenu.value = false;
  showLoginModal.value = true;
  authError.value = "";
  authHint.value = "";
  codeInput.value = "";
};

const closeLoginModal = () => {
  showLoginModal.value = false;
  authError.value = "";
  authHint.value = "";
};

const handleSendCode = async () => {
  if (isSendingCode.value || resendCountdown.value > 0) return;
  const phone = phoneInput.value.trim();

  authError.value = "";
  authHint.value = "";

  if (!isValidPhone(phone)) {
    authError.value = "Invalid phone number. Please enter 11 digits.";
    return;
  }

  isSendingCode.value = true;
  try {
    const response = await sendSmsCode({ phone });
    authHint.value = "SMS request accepted. Please check your messages.";
    startResendCountdown(response.resendIntervalSeconds || 60);
  } catch (error) {
    authError.value = formatApiError(error);
  } finally {
    isSendingCode.value = false;
  }
};

const handleSmsLogin = async () => {
  if (isLoggingIn.value) return;
  const phone = phoneInput.value.trim();
  const code = codeInput.value.trim();

  authError.value = "";
  authHint.value = "";

  if (!isValidPhone(phone)) {
    authError.value = "Invalid phone number. Please enter 11 digits.";
    return;
  }
  if (!isValidCode(code)) {
    authError.value = "Invalid verification code. Please enter 4-8 digits.";
    return;
  }

  isLoggingIn.value = true;
  try {
    const user = await loginBySms({ phone, code });
    currentUser.value = user;
    saveUser(user);
    closeLoginModal();
  } catch (error) {
    authError.value = formatApiError(error);
  } finally {
    isLoggingIn.value = false;
  }
};

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const handleLogout = () => {
  showUserMenu.value = false;
  currentUser.value = null;
  saveUser(null);
};

const upsertStory = (story: Story) => {
  const existingIndex = stories.value.findIndex((item) => item.id === story.id);
  if (existingIndex >= 0) {
    stories.value = stories.value.map((item) => (item.id === story.id ? { ...item, ...story } : item));
    return;
  }
  stories.value = [story, ...stories.value];
};

const applyDetailToStory = (detail: ArticleDetailResponse) => {
  upsertStory(mapDetailToStory(detail));
};

const loadStories = async () => {
  isLoading.value = true;
  loadError.value = "";
  dataSource.value = "loading";
  pushDebug("Request: GET /api/news/articles?page=1&pageSize=5&includeAltLang=true");

  try {
    const response = await fetchArticles({
      page: 1,
      pageSize: 5,
      lang: preferredLang.value === "zh" ? "zh" : undefined,
      includeAltLang: true,
    });

    const items = response.items ?? [];
    if (items.length > 0) {
      stories.value = items.map(mapListItemToStory);
      selectedId.value = stories.value[0]?.id ?? defaultStory.id;
    }

    dataSource.value = "live";
    pushDebug(`Response: /api/news/articles items=${items.length}`);
  } catch (error) {
    loadError.value = formatApiError(error);
    dataSource.value = "mock";
    pushDebug(`Error: /api/news/articles ${loadError.value}`);
  } finally {
    isLoading.value = false;
  }
};

const loadStoryDetail = async (storyId: string) => {
  isDetailLoading.value = true;
  detailError.value = "";
  pushDebug(`Request: GET /api/news/articles/${storyId}?lang=zh`);

  try {
    const detail = await fetchArticleDetail(storyId, preferredLang.value === "zh" ? "zh" : undefined);
    applyDetailToStory(detail);
    pushDebug(`Response: /api/news/articles/${storyId}`);
  } catch (error) {
    detailError.value = formatApiError(error);
    pushDebug(`Error: /api/news/articles/${storyId} ${detailError.value}`);
  } finally {
    isDetailLoading.value = false;
  }
};

const handleSelect = (story: Story) => {
  selectedId.value = story.id;
};

const handleSelectArticleFromChat = async (articleId: number) => {
  const storyId = String(articleId);
  if (stories.value.some((story) => story.id === storyId)) {
    selectedId.value = storyId;
    return;
  }

  isDetailLoading.value = true;
  detailError.value = "";
  pushDebug(`Request: GET /api/news/articles/${storyId}?lang=zh [from chat]`);

  try {
    const detail = await fetchArticleDetail(storyId, preferredLang.value === "zh" ? "zh" : undefined);
    applyDetailToStory(detail);
    selectedId.value = storyId;
    pushDebug(`Response: /api/news/articles/${storyId} [from chat]`);
  } catch (error) {
    detailError.value = formatApiError(error);
    pushDebug(`Error: /api/news/articles/${storyId} [from chat] ${detailError.value}`);
  } finally {
    isDetailLoading.value = false;
  }
};

watch(selectedId, (id) => {
  if (!id || !isNumericId(id)) return;
  void loadStoryDetail(id);
});

restoreUser();
pushDebug("Init: loadStories()");
void loadStories();

onBeforeUnmount(() => {
  clearResendTimer();
});
</script>

<template>
  <div class="app-layout">
    <header class="panel panel-soft app-topbar">
      <h1 class="app-topbar__title">News Aggregation</h1>
      <div>
        <div v-if="currentUser" class="auth-user">
          <button type="button" class="auth-user__button" @click="toggleUserMenu">
            {{ currentUser.username }}
          </button>
          <div v-if="showUserMenu" class="auth-user__menu">
            <button type="button" class="auth-user__menu-item" @click="handleLogout">
              Logout
            </button>
          </div>
        </div>
        <button v-else type="button" class="auth-login-button" @click="openLoginModal">
          Login
        </button>
      </div>
    </header>

    <div class="app-shell">
      <SidebarNav />

      <main class="space-y-6 scroll-column">
        <section class="panel panel-soft p-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Live Dashboard</p>
              <h2 class="text-2xl font-semibold text-slate-900">Signal-first briefing with AI research lanes</h2>
            </div>
            <div class="flex items-center gap-3">
              <span class="badge">82 live topics</span>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                24h coverage
              </span>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                Source: {{ dataSource === "live" ? "API" : "Mock" }}
              </span>
            </div>
          </div>
          <div v-if="loadError" class="detail-panel detail-panel--chat mt-4">
            <p class="detail-panel__title">News feed fallback</p>
            <p class="detail-panel__summary">{{ loadError }}</p>
          </div>
          <div class="detail-panel detail-panel--chat mt-4">
            <p class="detail-panel__eyebrow">Debug</p>
            <ul class="debug-list">
              <li v-for="event in debugEvents" :key="event">{{ event }}</li>
            </ul>
          </div>
        </section>

        <section class="panel p-5">
          <div v-if="isLoading" class="detail-panel detail-panel--chat mb-4">
            <p class="detail-panel__summary">Loading latest stories...</p>
          </div>
          <TopStories :stories="stories" :active-id="selectedId" @select="handleSelect" />
        </section>
      </main>

      <NewsDetailPanel
        :selected-story="selectedStory"
        :detail-loading="isDetailLoading"
        :detail-error="detailError"
      />

      <ChatPanel
        :active-article-id="selectedId"
        @select-article="handleSelectArticleFromChat"
      />
    </div>

    <div v-if="showLoginModal" class="auth-modal-mask" @click.self="closeLoginModal">
      <section class="panel auth-modal p-5">
        <header class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Authentication</p>
            <h2 class="section-title">SMS Login</h2>
          </div>
          <button type="button" class="auth-close-button" @click="closeLoginModal">Close</button>
        </header>

        <div class="mt-4 space-y-3">
          <div v-if="authError" class="detail-panel detail-panel--chat">
            <p class="detail-panel__title">Login failed</p>
            <p class="detail-panel__summary">{{ authError }}</p>
          </div>
          <div v-if="authHint" class="detail-panel detail-panel--chat">
            <p class="detail-panel__summary">{{ authHint }}</p>
          </div>

          <label class="auth-field">
            <span>Phone</span>
            <input
              v-model="phoneInput"
              class="auth-input"
              type="text"
              inputmode="numeric"
              maxlength="11"
              placeholder="Enter 11-digit phone"
            />
          </label>

          <label class="auth-field">
            <span>Code</span>
            <div class="auth-code-row">
              <input
                v-model="codeInput"
                class="auth-input"
                type="text"
                inputmode="numeric"
                maxlength="8"
                placeholder="Enter verification code"
              />
              <button
                type="button"
                class="auth-code-button"
                :disabled="isSendingCode || resendCountdown > 0"
                @click="handleSendCode"
              >
                <span v-if="resendCountdown > 0">{{ resendCountdown }}s</span>
                <span v-else>{{ isSendingCode ? "Sending" : "Send Code" }}</span>
              </button>
            </div>
          </label>
        </div>

        <footer class="auth-modal__footer">
          <button type="button" class="auth-cancel-button" @click="closeLoginModal">Cancel</button>
          <button
            type="button"
            class="auth-submit-button"
            :disabled="isLoggingIn"
            @click="handleSmsLogin"
          >
            {{ isLoggingIn ? "Logging in..." : "Login" }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>
