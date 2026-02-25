<script setup lang="ts">
import type { Story } from "../types/news";
import NewsCard from "./NewsCard.vue";

defineProps<{
  stories: Story[];
  activeId: string;
}>();

const emit = defineEmits<{
  (event: "select", story: Story): void;
}>();
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="section-title">Top Stories</h2>
      <span class="badge">Trending</span>
    </div>
    <div class="story-grid">
      <NewsCard
        v-for="story in stories"
        :key="story.id"
        :story="story"
        :is-active="story.id === activeId"
        @click="emit('select', story)"
      />
    </div>
  </section>
</template>
