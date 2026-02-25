<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { topStories } from "./data/mock";
import type { Story } from "./types/news";
import type { ArticleListItem, ArticleDetailResponse } from "./types/api";
import SidebarNav from "./components/SidebarNav.vue";
import TopStories from "./components/TopStories.vue";
import NewsDetailPanel from "./components/NewsDetailPanel.vue";
import ChatPanel from "./components/ChatPanel.vue";
import { fetchArticleDetail, fetchArticles } from "./services/news";
import { formatApiError } from "./services/http";

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
const preferredLang = ref<string>(
  typeof navigator !== "undefined" && navigator.language.startsWith("zh")
    ? "zh"
    : "en"
);

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

const isNumericId = (id: string) => Number.isFinite(Number(id));

const pushDebug = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  debugEvents.value = [`[${timestamp}] ${message}`, ...debugEvents.value].slice(0, 8);
};

const applyDetailToStory = (detail: ArticleDetailResponse) => {
  const storyId = String(detail.id);
  const updated = stories.value.map((story) => {
    if (story.id !== storyId) return story;
    return {
      ...story,
      title: detail.title ?? story.title,
      summary: detail.summary ?? story.summary,
      detailSummary: detail.content ?? detail.summary ?? story.detailSummary,
      image: detail.imageUrl ?? story.image,
      source: detail.source ?? story.source,
      link: detail.link ?? story.link,
      publishedAt: detail.publishedAt ?? story.publishedAt,
      updatedAt: formatPublishedAt(detail),
      content: detail.content ?? story.content,
    };
  });
  stories.value = updated;
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
    const detail = await fetchArticleDetail(
      storyId,
      preferredLang.value === "zh" ? "zh" : undefined
    );
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

watch(selectedId, (id) => {
  if (!id || !isNumericId(id)) return;
  void loadStoryDetail(id);
});

pushDebug("Init: loadStories()");
void loadStories();
</script>

<template>
  <div class="app-shell">
    <SidebarNav />

    <main class="space-y-6">
      <section class="panel panel-soft p-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">News Aggregation</p>
            <h1 class="text-2xl font-semibold text-slate-900">
              Signal-first briefing with AI research lanes
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <span class="badge">82 live topics</span>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              24h coverage
            </span>
            <span
              class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500"
            >
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
        <TopStories
          :stories="stories"
          :active-id="selectedId"
          @select="handleSelect"
        />
      </section>
    </main>

    <NewsDetailPanel
      :selected-story="selectedStory"
      :detail-loading="isDetailLoading"
      :detail-error="detailError"
    />
    <ChatPanel />
  </div>
</template>
