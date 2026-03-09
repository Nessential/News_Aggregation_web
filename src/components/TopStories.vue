<script setup lang="ts">
import type { Story } from "../types/news";
import NewsCard from "./NewsCard.vue";

defineProps<{
  stories: Story[];
  activeId: string;
  totalItems: number;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
}>();

const emit = defineEmits<{
  (event: "select", story: Story): void;
}>();
</script>

<template>
  <section class="stories-panel">
    <div class="flex items-center justify-between">
      <h2 class="section-title">Top Stories</h2>
      <span class="badge">{{ totalItems }} stories</span>
    </div>
    <div class="stories-panel__content">
      <div class="story-grid">
        <NewsCard
          v-for="story in stories"
          :key="story.id"
          :story="story"
          :is-active="story.id === activeId"
          @click="emit('select', story)"
        />
      </div>
      <div v-if="!loading && stories.length === 0" class="detail-panel detail-panel--chat">
        <p class="detail-panel__summary">No stories found for this page.</p>
      </div>
      <div v-if="loadingMore" class="detail-panel detail-panel--chat mt-3">
        <p class="detail-panel__summary">Loading more stories...</p>
      </div>
      <div v-else-if="!loading && !hasMore && stories.length > 0" class="detail-panel detail-panel--chat mt-3">
        <p class="detail-panel__summary">No more stories.</p>
      </div>
    </div>
  </section>
</template>
