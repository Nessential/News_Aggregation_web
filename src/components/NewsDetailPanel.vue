<script setup lang="ts">
import type { Story } from "../types/news";

defineProps<{
  selectedStory: Story;
  detailLoading?: boolean;
  detailError?: string;
}>();
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
        <p class="text-sm text-slate-500">{{ selectedStory.detailSummary }}</p>
        <p class="text-xs font-semibold text-slate-400">{{ selectedStory.updatedAt }}</p>
      </div>
      <div class="detail-panel">
        <p class="detail-panel__eyebrow">Evidence (Mock)</p>
        <p class="detail-panel__summary">
          Verified updates are being aggregated from official sources and on-site reports to
          maintain a clean, searchable incident timeline.
        </p>
      </div>
    </div>
  </aside>
</template>
