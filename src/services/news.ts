import type { ArticleDetailResponse, ArticleListResponse } from "../types/api";
import { createApiClient } from "./http";

const newsBaseUrl =
  import.meta.env.VITE_NEWS_API_BASE_URL ?? "http://localhost:8080";

const client = createApiClient(newsBaseUrl);

export interface FetchArticlesParams {
  page?: number;
  pageSize?: number;
  lang?: string;
  includeAltLang?: boolean;
  keyword?: string;
  source?: string;
  category?: string;
}

const buildQuery = (params: FetchArticlesParams = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.lang) query.set("lang", params.lang);
  if (params.includeAltLang !== undefined) {
    query.set("includeAltLang", String(params.includeAltLang));
  }
  if (params.keyword) query.set("keyword", params.keyword);
  if (params.source) query.set("source", params.source);
  if (params.category) query.set("category", params.category);
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const fetchArticles = async (params?: FetchArticlesParams) => {
  const query = buildQuery(params);
  return client.request<ArticleListResponse>(`/api/news/articles${query}`);
};

export const fetchArticleDetail = async (id: string | number, lang?: string) => {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return client.request<ArticleDetailResponse>(`/api/news/articles/${id}${query}`);
};

export const fetchArticlesByIds = async (ids: Array<number | string>) => {
  return client.request<{ articles: ArticleDetailResponse[] }>(
    "/api/news/articles/by-ids",
    {
      method: "POST",
      body: { ids: ids.map((id) => Number(id)) },
    }
  );
};
