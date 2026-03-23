import "./style.css";
import { createApp } from "vue";
import { loadAppConfig } from "./config/app";

const bootstrap = async () => {
  await loadAppConfig();
  const { default: App } = await import("./App.vue");
  createApp(App).mount("#app");
};

void bootstrap();
