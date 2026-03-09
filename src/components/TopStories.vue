<script setup lang="ts">
import type { Story } from "../types/news";
import NewsCard from "./NewsCard.vue";

defineProps<{
  stories: Story[];
  activeId: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: "select", story: Story): void;
  (event: "change-page", page: number): void;
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
    </div>
    <div v-if="totalPages > 1" class="stories-panel__pagination">
      <button
        type="button"
        class="pagination-button"
        :disabled="currentPage <= 1"
        @click="emit('change-page', currentPage - 1)"
      >
        Prev
      </button>
      <div class="pagination-strip">
        <button
          v-for="page in totalPages"
          :key="page"
          type="button"
          class="pagination-chip"
          :class="{ 'is-active': page === currentPage }"
          @click="emit('change-page', page)"
        >
          {{ page }}
        </button>
      </div>
      <button
        type="button"
        class="pagination-button"
        :disabled="currentPage >= totalPages"
        @click="emit('change-page', currentPage + 1)"
      >
        Next
      </button>
    </div>
  </section>
</template>
