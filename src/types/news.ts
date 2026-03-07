import type { AgentAnswerItem } from "./api";

export interface Category {
  id: string;
  label: string;
  iconPath: string;
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  image: string;
  updatedAt: string;
  detailSummary: string;
  highlights: string[];
  source?: string;
  link?: string;
  publishedAt?: string;
  content?: string;
}

export interface ArticleAction {
  id: string;
  label: string;
  iconPath: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  time: string;
  answerItems?: AgentAnswerItem[];
}
