import type {
  SmsLoginRequest,
  SmsSendCodeRequest,
  SmsSendCodeResponse,
  UserAuthInfo,
} from "../types/api";
import { createApiClient } from "./http";

const newsBaseUrl = import.meta.env.VITE_NEWS_API_BASE_URL ?? "http://localhost:8080";

const client = createApiClient(newsBaseUrl);

export const sendSmsCode = async (payload: SmsSendCodeRequest) => {
  return client.request<SmsSendCodeResponse>("/api/user/auth/sms/send-code", {
    method: "POST",
    body: payload,
  });
};

export const loginBySms = async (payload: SmsLoginRequest) => {
  return client.request<UserAuthInfo>("/api/user/auth/sms/login", {
    method: "POST",
    body: payload,
  });
};
