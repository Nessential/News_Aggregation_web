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

export interface ArticleBatchItem {
  id: number;
  title: string;
  url?: string;
  content?: string;
  source?: string;
  publishedAt?: string;
}

export interface ArticleBatchResponse {
  articles: ArticleBatchItem[];
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
  sessionId?: string;
  turnId?: string;
  idempotencyKey?: string;
  query: string;
  constraints?: AgentChatConstraints;
}

export interface AgentRelatedNews {
  articleId: number;
  title?: string;
  url?: string;
  snippet?: string;
  score?: number | null;
  source?: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface AgentAnswerItem {
  text: string;
  newsIds?: number[];
  relatedNews?: AgentRelatedNews[];
}

export interface AgentChatResponse {
  sessionId?: string;
  turnId?: string;
  turnStatus?: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED" | "BUSY";
  errorCode?: string | null;
  runningTurnId?: string | null;
  answer?: string;
  answerItems?: AgentAnswerItem[];
  taskFamily?: string;
  needsClarification?: boolean;
  clarificationPrompt?: string | null;
  timestamp?: string;
  executionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionState {
  sessionId: string;
  userId?: string;
  activeTurnId?: string | null;
  history?: AgentHistoryMessage[];
  constraints?: AgentChatConstraints;
  budget?: Record<string, unknown> | null;
}

export interface AgentHistoryMessage {
  messageId: number;
  turnId: string;
  sessionId: string;
  userId?: string;
  requestHash?: string;
  role: 0 | 1;
  status: 0 | 1 | 2;
  seqNo: number;
  content: string;
  createdAt: string;
}

export interface AgentHistoryResponse {
  sessionId: string;
  turnId?: string;
  messages: AgentHistoryMessage[];
  count: number;
}

export interface AgentUserHistoryResponse {
  userId: string;
  pageNum: number;
  pageSize: number;
  messages: AgentHistoryMessage[];
  count: number;
}

export interface SmsSendCodeRequest {
  phone: string;
}

export interface SmsSendCodeResponse {
  success: boolean;
  requestId: string;
  expireSeconds: number;
  resendIntervalSeconds: number;
}

export interface SmsLoginRequest {
  phone: string;
  code: string;
}

export interface UserAuthInfo {
  userId: number;
  username: string;
  email: string | null;
  phone: string;
  newUser: boolean;
  token: string;
}
