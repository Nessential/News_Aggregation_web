export interface ArticleListItem {
  id: number;
  title: string;
  summary: string;
  titleCn?: string;
  summaryCn?: string;
  titleEn?: string;
  summaryEn?: string;
  imageUrl?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  publicationTime?: number;
}

export interface ArticleListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ArticleListItem[];
}

export interface ArticleDetailResponse extends ArticleListItem {
  content?: string;
  contentCn?: string;
  contentEn?: string;
}

export interface AgentChatConstraints {
  timeRangeStart?: string;
  timeRangeEnd?: string;
  topics?: string[];
  sources?: string[];
  keywords?: string[];
  language?: string;
  maxResults?: number;
}

export interface AgentChatRequest {
  userId?: string;
  sessionId?: string;
  query: string;
  constraints?: AgentChatConstraints;
}

export interface AgentCandidate {
  articleId?: number;
  title?: string;
  url?: string;
  snippet?: string;
  source?: string;
  publishedAt?: string;
}

export interface AgentChatResponse {
  sessionId: string;
  answer: string;
  candidates?: AgentCandidate[];
  citations?: string[];
  taskFamily?: string;
  metadata?: Record<string, unknown>;
}
