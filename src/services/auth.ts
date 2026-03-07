import { APP_CONFIG } from "../config/app";
import type {
  SmsLoginRequest,
  SmsSendCodeRequest,
  SmsSendCodeResponse,
  UserAuthInfo,
} from "../types/api";
import { createApiClient } from "./http";

const client = createApiClient(() => APP_CONFIG.apiBaseUrls.news);

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
