<script setup lang="ts">
import { computed } from "vue";
import type { Story } from "../types/news";

const props = defineProps<{
  selectedStory: Story;
  detailLoading?: boolean;
  detailError?: string;
}>();

const articleBody = computed(() => props.selectedStory.content || props.selectedStory.detailSummary);
</script>

<template>
  <aside class="panel news-detail-panel p-5">
    <header class="flex items-center justify-between border-b border-slate-200 pb-3">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">News Detail</p>
        <h2 class="section-title">Selected Story</h2>
      </div>
      <span class="badge">Live</span>
    </header>

    <div class="mt-4 space-y-4">
      <a
        v-if="selectedStory.link"
        :href="selectedStory.link"
        target="_blank"
        rel="noopener noreferrer"
        class="source-link"
      >
        Open original article
      </a>
      <div v-if="detailError" class="detail-panel detail-panel--chat">
        <p class="detail-panel__title">Detail unavailable</p>
        <p class="detail-panel__summary">{{ detailError }}</p>
      </div>
      <div v-else-if="detailLoading" class="detail-panel detail-panel--chat">
        <p class="detail-panel__summary">Loading story details...</p>
      </div>
      <img
        :src="selectedStory.image"
        :alt="selectedStory.title"
        class="h-32 w-full rounded-2xl object-cover"
      />
      <div class="space-y-2">
        <h3 class="text-base font-semibold text-slate-900">
          {{ selectedStory.title }}
        </h3>
        <p v-if="selectedStory.source" class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {{ selectedStory.source }}
        </p>
        <p class="text-xs font-semibold text-slate-400">{{ selectedStory.updatedAt }}</p>
      </div>
      <div class="detail-panel">
        <p class="detail-panel__eyebrow">Summary</p>
        <p class="detail-panel__summary">{{ selectedStory.summary }}</p>
      </div>
      <div class="detail-panel">
        <p class="detail-panel__eyebrow">Content</p>
        <p class="detail-panel__body">{{ articleBody }}</p>
      </div>
    </div>
  </aside>
</template>
