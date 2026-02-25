<script setup lang="ts">
import { ref } from "vue";
import { categories } from "../data/mock";

const activeId = ref<string>(categories[0]?.id ?? "top-stories");

const setActive = (id: string) => {
  activeId.value = id;
};
</script>

<template>
  <aside class="panel bg-slate-900 text-white border border-slate-800 p-5">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-[0.2em] text-slate-400">Categories</p>
      <h2 class="section-title text-white">Discover</h2>
    </header>

    <nav class="flex flex-col gap-2">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeId === category.id }"
        @click="setActive(category.id)"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="currentColor"
            aria-hidden="true"
          >
            <path :d="category.iconPath" />
          </svg>
        </span>
        <span class="text-sm font-semibold">{{ category.label }}</span>
      </button>
    </nav>

    <button
      type="button"
      class="mt-8 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold"
    >
      <span>More</span>
      <span class="text-xs">&#9662;</span>
    </button>
  </aside>
</template>
