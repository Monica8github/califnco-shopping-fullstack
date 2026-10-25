import { AppError, assert } from "./domain.js";
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new AppError(503, `${name} is not configured on the server`);
  return v;
}
export async function jsonRequest(
  url: string,
  init: RequestInit = {},
  retry = false,
): Promise<any> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) return res.json();
    if (retry && (res.status === 429 || res.status >= 500) && i < 2) {
      await new Promise((r) => setTimeout(r, (i + 1) * 500));
      continue;
    }
    throw new AppError(502, `External service returned HTTP ${res.status}`);
  }
}
export async function razorpay(path: string, body?: unknown) {
  const key = required("RAZORPAY_KEY_ID");
  assert(
    key.startsWith("rzp_test_"),
    503,
    "This assignment accepts Razorpay test-mode keys only",
  );
  return jsonRequest(
    "https://api.razorpay.com/v1/" + path,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${key}:${required("RAZORPAY_KEY_SECRET")}`).toString(
            "base64",
          ),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    !body,
  );
}
