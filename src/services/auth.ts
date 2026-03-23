import { getApiBaseUrl } from "../config/app";
import type {
  SmsLoginRequest,
  SmsSendCodeRequest,
  SmsSendCodeResponse,
  UserQuotaMeResponse,
  UserAuthInfo,
} from "../types/api";
import { createApiClient } from "./http";

const client = createApiClient(() => getApiBaseUrl("news"));

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

export const getMyQuota = async () => {
  return client.request<UserQuotaMeResponse>("/api/user/auth/quota/me");
};
