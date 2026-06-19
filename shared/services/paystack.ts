import { config } from "../config/config";

const BASE = "https://api.paystack.co";

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { status: boolean; data: T; message: string };
  if (!json.status) throw new Error(json.message ?? "Paystack error");
  return json.data;
}

export interface PaystackInitResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResult {
  status: string;   // "success" | "failed" | "abandoned"
  amount: number;   // kobo
  reference: string;
  customer: { email: string };
}

export const paystack = {
  initializeTransaction(email: string, amountNaira: number, callbackUrl: string) {
    return paystackRequest<PaystackInitResult>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: amountNaira * 100, // convert to kobo
        callback_url: callbackUrl,
        currency: "NGN",
      }),
    });
  },

  verifyTransaction(reference: string) {
    return paystackRequest<PaystackVerifyResult>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
  },
};
