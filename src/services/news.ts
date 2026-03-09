import { APP_CONFIG } from "../config/app";
import type {
  ArticleBatchResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  NewsCategory,
} from "../types/api";
import { createApiClient } from "./http";

const client = createApiClient(() => APP_CONFIG.apiBaseUrls.news);

export interface FetchArticlesParams {
  page?: number;
  pageSize?: number;
  lang?: string;
  includeAltLang?: boolean;
  keyword?: string;
  source?: string;
  categoryId?: number;
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
  if (params.categoryId) query.set("categoryId", String(params.categoryId));
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

export const fetchCategories = async () => {
  return client.request<NewsCategory[]>("/api/news/categories");
};

export const fetchArticlesByCategory = async (
  categoryId: number,
  params?: FetchArticlesParams
) => {
  const query = buildQuery({ ...params, categoryId: undefined });
  return client.request<ArticleListResponse>(
    `/api/news/articles/by-category/${categoryId}${query}`
  );
};

export const fetchArticlesByIds = async (ids: Array<number | string>) => {
  return client.request<ArticleBatchResponse>(
    "/api/news/articles/by-ids",
    {
      method: "POST",
      body: { ids: ids.map((id) => Number(id)) },
    }
  );
};
