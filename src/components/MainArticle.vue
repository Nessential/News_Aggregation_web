<script setup lang="ts">
import type { Story } from "../types/news";
import { articleActions } from "../data/mock";

defineProps<{
  article: Story;
}>();
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-slate-900">
          {{ article.title }}
        </h1>
        <p class="text-sm font-semibold text-slate-400">
          {{ article.updatedAt }}
        </p>
      </div>
      <span class="badge">Breaking</span>
    </div>

    <img
      :src="article.image"
      :alt="article.title"
      class="h-64 w-full rounded-2xl object-cover"
    />

    <p class="text-sm leading-relaxed text-slate-600">
      {{ article.detailSummary }}
    </p>

    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Key Highlights
      </p>
      <ul class="space-y-2">
        <li
          v-for="(highlight, index) in article.highlights"
          :key="`${article.id}-${index}`"
          class="flex items-start gap-3 text-sm text-slate-600"
        >
          <span class="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
          <span>{{ highlight }}</span>
        </li>
      </ul>
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        v-for="action in articleActions"
        :key="action.id"
        type="button"
        class="action-button"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-4 w-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="action.iconPath" />
        </svg>
        <span>{{ action.label }}</span>
      </button>
    </div>
  </section>
</template>
