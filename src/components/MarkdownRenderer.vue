<script setup lang="ts">
import { computed } from "vue";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

const props = defineProps<{
  content?: string;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const safeHtml = computed(() => {
  const raw = (props.content || "").trim();
  if (!raw) return "";
  const rendered = md.render(raw);
  const sanitized = DOMPurify.sanitize(rendered, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?):|mailto:|#)/i,
  });
  const container = document.createElement("div");
  container.innerHTML = sanitized;
  container.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
  return container.innerHTML;
});
</script>

<template>
  <div class="markdown-content" v-html="safeHtml" />
</template>
