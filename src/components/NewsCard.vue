<script setup lang="ts">
import type { Story } from "../types/news";

defineProps<{
  story: Story;
  isActive: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="story-card story-card--compact text-left"
    :class="{ 'story-card--active': isActive }"
  >
    <img :src="story.image" :alt="story.title" class="story-card__image" />
    <div class="story-card__body">
      <h3 class="story-card__title">
        {{ story.title }}
      </h3>
      <p class="story-card__meta">{{ story.updatedAt }}</p>
    </div>
  </button>
</template>
