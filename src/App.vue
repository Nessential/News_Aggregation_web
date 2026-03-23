<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { categories as mockCategories, topStories } from "./data/mock";
import type { Category, Story } from "./types/news";
import type {
  FeatureQuotaMap,
  ArticleDetailResponse,
  ArticleListItem,
  NewsCategory,
  UserAuthInfo,
} from "./types/api";
import SidebarNav from "./components/SidebarNav.vue";
import TopStories from "./components/TopStories.vue";
import NewsDetailPanel from "./components/NewsDetailPanel.vue";
import ChatPanel from "./components/ChatPanel.vue";
import { APP_CONFIG } from "./config/app";
import {
  fetchArticleDetail,
  fetchArticles,
  fetchArticlesByCategory,
  fetchCategories,
} from "./services/news";
import { formatApiError } from "./services/http";
import { loginBySms, sendSmsCode } from "./services/auth";

const fallbackStories = topStories;
const defaultStory = fallbackStories[0]!;
const MIN_PAGE_SIZE = 9;
const defaultCategory: Category = {
  id: "all",
  label: "All",
  iconPath: mockCategories[0]?.iconPath ?? "M12 3l7 4v6c0 4-3 7-7 9-4-2-7-5-7-9V7l7-4z",
};

const categories = ref<Category[]>([defaultCategory]);
const activeCategoryId = ref<string>(defaultCategory.id);
const stories = ref<Story[]>(fallbackStories);
const selectedId = ref<string>(defaultStory.id);
const selectedStoryDetail = ref<Story | null>(null);
const currentPage = ref<number>(1);
const pageSize = ref<number>(MIN_PAGE_SIZE);
const totalStories = ref<number>(fallbackStories.length);
const isLoading = ref<boolean>(false);
const isLoadingMore = ref<boolean>(false);
const isDetailLoading = ref<boolean>(false);
const loadError = ref<string>("");
const detailError = ref<string>("");
const dataSource = ref<"live" | "mock" | "loading">("mock");
const debugEvents = ref<string[]>([]);
const categoryError = ref<string>("");

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

const storiesLang = ref<"zh" | "en">(
  typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh" : "en"
);
const detailLang = ref<"zh" | "en">(
  typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh" : "en"
);

const USER_STORAGE_KEY = "news_user_auth";
const USER_STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let resendTimer: ReturnType<typeof setInterval> | null = null;
let storiesResizeObserver: ResizeObserver | null = null;
const storiesShellRef = ref<HTMLElement | null>(null);
const storiesScrollerRef = ref<HTMLElement | null>(null);

const selectedStory = computed<Story>(() => {
  return stories.value.find((story) => story.id === selectedId.value) ?? defaultStory;
});

const detailPanelStory = computed<Story>(() => {
  if (selectedStoryDetail.value && selectedStoryDetail.value.id === selectedId.value) {
    return selectedStoryDetail.value;
  }
  return selectedStory.value;
});

const currentUserQuotas = computed<FeatureQuotaMap | null>(() => {
  const user = currentUser.value;
  if (!user) return null;
  return user.featureQuotas ?? null;
});

const totalPages = computed(() => Math.max(1, Math.ceil(totalStories.value / pageSize.value)));
const hasMoreStories = computed(() => currentPage.value < totalPages.value);

const updatePageSize = () => {
  const element = storiesShellRef.value;
  if (!element) return;

  const width = element.clientWidth;
  const height = element.clientHeight;
  if (width <= 0 || height <= 0) return;

  const columns = width >= 1200 ? 3 : Math.max(1, Math.floor(width / 210));
  const availableHeight = Math.max(220, height - 96);
  const rows = Math.max(1, Math.floor(availableHeight / 206));
  const nextPageSize = Math.max(MIN_PAGE_SIZE, columns * rows);

  if (nextPageSize !== pageSize.value) {
    pageSize.value = nextPageSize;
    currentPage.value = 1;
    stories.value = [];
    void loadStories();
  }
};

const buildCategoryIcon = (index: number) => {
  return (
    mockCategories[index % mockCategories.length]?.iconPath ??
    defaultCategory.iconPath
  );
};

const mapCategory = (category: NewsCategory, index: number): Category => ({
  id: String(category.id),
  apiId: category.id,
  label: category.name,
  iconPath: buildCategoryIcon(index),
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

const pickLocalizedText = (
  lang: "zh" | "en",
  primary: string | undefined,
  zh: string | undefined,
  en: string | undefined
) => {
  if (lang === "zh") {
    return zh || primary || en || "";
  }
  return en || primary || zh || "";
};

const mapListItemToStory = (item: ArticleListItem, index: number): Story => {
  const fallbackImage = fallbackStories[index % fallbackStories.length]?.image ?? "";
  return {
    id: String(item.id),
    title:
      pickLocalizedText(storiesLang.value, item.title, item.titleCn, item.titleEn) ||
      item.title ||
      "Untitled article",
    summary:
      pickLocalizedText(storiesLang.value, item.summary, item.summaryCn, item.summaryEn) ||
      item.summary ||
      "",
    image: item.imageUrl ?? fallbackImage,
    updatedAt: formatPublishedAt(item),
    detailSummary:
      pickLocalizedText(storiesLang.value, item.summary, item.summaryCn, item.summaryEn) ||
      item.summary ||
      "",
    highlights: [],
    source: item.source,
    link: item.link,
    publishedAt: item.publishedAt,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
  };
};

const mapDetailToStory = (detail: ArticleDetailResponse): Story => {
  const existing = stories.value.find((story) => story.id === String(detail.id));
  const fallbackImage = existing?.image ?? fallbackStories[0]?.image ?? "";
  const localizedSummary =
    pickLocalizedText(detailLang.value, detail.summary, detail.summaryCn, detail.summaryEn) ||
    existing?.summary ||
    "";
  const localizedContent =
    pickLocalizedText(detailLang.value, detail.content, detail.contentCn, detail.contentEn) ||
    localizedSummary;
  return {
    id: String(detail.id),
    title:
      pickLocalizedText(detailLang.value, detail.title, detail.titleCn, detail.titleEn) ||
      existing?.title ||
      "Untitled article",
    summary: localizedSummary,
    image: detail.imageUrl ?? fallbackImage,
    updatedAt: formatPublishedAt(detail),
    detailSummary: localizedContent || existing?.detailSummary || "",
    highlights: existing?.highlights ?? [],
    source: detail.source ?? existing?.source,
    link: detail.link ?? existing?.link,
    publishedAt: detail.publishedAt ?? existing?.publishedAt,
    content: localizedContent || existing?.content,
    categoryId: detail.categoryId ?? existing?.categoryId,
    categoryName: detail.categoryName ?? existing?.categoryName,
  };
};

const mapDetailToListStory = (detail: ArticleDetailResponse): Story => {
  const existing = stories.value.find((story) => story.id === String(detail.id));
  const fallbackImage = existing?.image ?? fallbackStories[0]?.image ?? "";
  return {
    id: String(detail.id),
    title:
      pickLocalizedText(storiesLang.value, detail.title, detail.titleCn, detail.titleEn) ||
      existing?.title ||
      "Untitled article",
    summary:
      pickLocalizedText(storiesLang.value, detail.summary, detail.summaryCn, detail.summaryEn) ||
      existing?.summary ||
      "",
    image: detail.imageUrl ?? fallbackImage,
    updatedAt: formatPublishedAt(detail),
    detailSummary:
      pickLocalizedText(storiesLang.value, detail.summary, detail.summaryCn, detail.summaryEn) ||
      existing?.detailSummary ||
      "",
    highlights: existing?.highlights ?? [],
    source: detail.source ?? existing?.source,
    link: detail.link ?? existing?.link,
    publishedAt: detail.publishedAt ?? existing?.publishedAt,
    content: existing?.content,
    categoryId: detail.categoryId ?? existing?.categoryId,
    categoryName: detail.categoryName ?? existing?.categoryName,
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

const isUserAuthInfo = (value: unknown): value is UserAuthInfo => {
  if (!value || typeof value !== "object") return false;
  return (
    "username" in value &&
    typeof value.username === "string" &&
    "phone" in value &&
    typeof value.phone === "string"
  );
};

const saveUser = (user: UserAuthInfo | null) => {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    APP_CONFIG.auth.bearerToken = "";
    return;
  }
  if (user.token) {
    APP_CONFIG.auth.bearerToken = user.token;
  }
  localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      user,
      expiresAt: Date.now() + USER_STORAGE_TTL_MS,
    })
  );
};

const restoreUser = () => {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as
      | UserAuthInfo
      | {
          user?: UserAuthInfo;
          expiresAt?: number;
        };

    if (
      parsed &&
      typeof parsed === "object" &&
      "user" in parsed &&
      parsed.user &&
      typeof parsed.expiresAt === "number"
    ) {
      if (parsed.expiresAt <= Date.now()) {
        localStorage.removeItem(USER_STORAGE_KEY);
        return;
      }
      if (isUserAuthInfo(parsed.user)) {
        currentUser.value = parsed.user;
        if (parsed.user.token) {
          APP_CONFIG.auth.bearerToken = parsed.user.token;
        }
      }
      return;
    }

    if (isUserAuthInfo(parsed)) {
      currentUser.value = parsed;
      if (parsed.token) {
        APP_CONFIG.auth.bearerToken = parsed.token;
      }
      saveUser(parsed);
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
  codeInput.value = "";
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
    pushDebug(`Login success: userId=${user.userId} token=${user.token ?? "(empty)"}`);
    authError.value = "";
    authHint.value = "";
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

const handleAuthExpired = () => {
  handleLogout();
  authError.value = "Login expired. Please log in again.";
};

const handleRequireLogin = () => {
  openLoginModal();
};

const upsertStory = (story: Story) => {
  const existingIndex = stories.value.findIndex((item) => item.id === story.id);
  if (existingIndex >= 0) {
    stories.value = stories.value.map((item) => (item.id === story.id ? { ...item, ...story } : item));
    return;
  }
  stories.value = [story, ...stories.value];
};

const loadCategories = async () => {
  categoryError.value = "";
  pushDebug("Request: GET /api/news/categories");

  try {
    const response = await fetchCategories();
    categories.value = [defaultCategory, ...response.map(mapCategory)];
    pushDebug(`Response: /api/news/categories items=${response.length}`);
  } catch (error) {
    categoryError.value = formatApiError(error);
    categories.value = [defaultCategory, ...mockCategories];
    pushDebug(`Error: /api/news/categories ${categoryError.value}`);
  }
};

const requestStoriesPage = async (page: number) => {
  pushDebug(
    `Request: GET /api/news/articles?page=${page}&pageSize=${pageSize.value}&includeAltLang=true`
  );

  const activeCategory = categories.value.find(
    (category) => category.id === activeCategoryId.value
  );
  const params = {
    page,
    pageSize: pageSize.value,
    lang: storiesLang.value === "zh" ? "zh" : undefined,
    includeAltLang: true,
    categoryId: activeCategory?.apiId,
  };

  return activeCategory?.apiId && activeCategoryId.value !== defaultCategory.id
    ? fetchArticlesByCategory(activeCategory.apiId, params)
    : fetchArticles(params);
};

const loadStories = async (options?: { append?: boolean }) => {
  const append = options?.append ?? false;
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
    loadError.value = "";
    dataSource.value = "loading";
  }

  try {
    const response = await requestStoriesPage(currentPage.value);
    const items = response.items ?? [];
    const mappedStories = items.map(mapListItemToStory);
    totalStories.value = response.total ?? items.length;

    if (append) {
      stories.value = [...stories.value, ...mappedStories];
    } else if (mappedStories.length > 0) {
      stories.value = mappedStories;
      selectedId.value = mappedStories[0]?.id ?? defaultStory.id;
    } else {
      stories.value = [];
    }

    dataSource.value = "live";
    pushDebug(`Response: /api/news/articles items=${items.length} total=${totalStories.value}`);
  } catch (error) {
    loadError.value = formatApiError(error);
    dataSource.value = "mock";
    totalStories.value = fallbackStories.length;
    if (!append) {
      stories.value = fallbackStories.slice(0, pageSize.value);
    }
    pushDebug(`Error: /api/news/articles ${loadError.value}`);
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
};

const loadStoryDetail = async (storyId: string) => {
  isDetailLoading.value = true;
  detailError.value = "";
  pushDebug(`Request: GET /api/news/articles/${storyId}?lang=${detailLang.value}`);

  try {
    const detail = await fetchArticleDetail(storyId, detailLang.value === "zh" ? "zh" : undefined);
    selectedStoryDetail.value = mapDetailToStory(detail);
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
  selectedStoryDetail.value = null;
};

const handleSelectCategory = (category: Category) => {
  if (category.id === activeCategoryId.value) return;
  activeCategoryId.value = category.id;
  currentPage.value = 1;
  selectedId.value = "";
  selectedStoryDetail.value = null;
  stories.value = [];
  void loadStories();
};

const toggleStoriesLang = () => {
  storiesLang.value = storiesLang.value === "zh" ? "en" : "zh";
  pushDebug(`Stories language switched: ${storiesLang.value}`);
  currentPage.value = 1;
  stories.value = [];
  void loadStories();
};

const toggleDetailLang = () => {
  detailLang.value = detailLang.value === "zh" ? "en" : "zh";
  pushDebug(`Detail language switched: ${detailLang.value}`);
  if (selectedId.value && isNumericId(selectedId.value)) {
    void loadStoryDetail(selectedId.value);
  }
};

const handleStoriesScroll = () => {
  const element = storiesScrollerRef.value;
  if (!element || isLoading.value || isLoadingMore.value || !hasMoreStories.value) return;

  const threshold = 120;
  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  if (distanceToBottom > threshold) return;

  currentPage.value += 1;
  void loadStories({ append: true });
};

const handleSelectArticleFromChat = async (articleId: number) => {
  const storyId = String(articleId);
  if (stories.value.some((story) => story.id === storyId)) {
    selectedId.value = storyId;
    selectedStoryDetail.value = null;
    return;
  }

  isDetailLoading.value = true;
  detailError.value = "";
  pushDebug(`Request: GET /api/news/articles/${storyId}?lang=${detailLang.value} [from chat]`);

  try {
    const detail = await fetchArticleDetail(storyId, detailLang.value === "zh" ? "zh" : undefined);
    upsertStory(mapDetailToListStory(detail));
    selectedStoryDetail.value = mapDetailToStory(detail);
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
  selectedStoryDetail.value = null;
  void loadStoryDetail(id);
});

restoreUser();
void loadCategories();
pushDebug("Init: loadStories()");
void loadStories();

onBeforeUnmount(() => {
  clearResendTimer();
  storiesResizeObserver?.disconnect();
});

onMounted(() => {
  if (typeof ResizeObserver === "undefined" || !storiesShellRef.value) return;
  storiesResizeObserver = new ResizeObserver(() => {
    updatePageSize();
  });
  storiesResizeObserver.observe(storiesShellRef.value);
  updatePageSize();
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
      <SidebarNav
        :categories="categories"
        :active-id="activeCategoryId"
        @select="handleSelectCategory"
      />

      <main class="main-column">
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
          <div v-if="categoryError" class="detail-panel detail-panel--chat mt-4">
            <p class="detail-panel__title">Category fallback</p>
            <p class="detail-panel__summary">{{ categoryError }}</p>
          </div>
          <div class="detail-panel detail-panel--chat mt-4">
            <p class="detail-panel__eyebrow">Debug</p>
            <ul class="debug-list">
              <li v-for="event in debugEvents" :key="event">{{ event }}</li>
            </ul>
          </div>
        </section>

        <section ref="storiesShellRef" class="panel p-5 stories-shell">
          <div v-if="isLoading" class="detail-panel detail-panel--chat mb-4">
            <p class="detail-panel__summary">Loading latest stories...</p>
          </div>
          <div ref="storiesScrollerRef" class="stories-scroll-area" @scroll="handleStoriesScroll">
          <TopStories
            :stories="stories"
            :active-id="selectedId"
            :total-items="totalStories"
            :loading="isLoading"
            :loading-more="isLoadingMore"
            :has-more="hasMoreStories"
            :preferred-lang="storiesLang"
            @select="handleSelect"
            @toggle-language="toggleStoriesLang"
          />
          </div>
        </section>
      </main>

      <NewsDetailPanel
        :selected-story="detailPanelStory"
        :detail-loading="isDetailLoading"
        :detail-error="detailError"
        :preferred-lang="detailLang"
        @toggle-language="toggleDetailLang"
      />

      <ChatPanel
        :active-article-id="selectedId"
        :current-user-id="currentUser ? String(currentUser.userId) : null"
        :initial-feature-quotas="currentUserQuotas"
        @auth-expired="handleAuthExpired"
        @require-login="handleRequireLogin"
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
