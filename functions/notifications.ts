import { createHash } from "node:crypto";
import { getMessaging } from "firebase-admin/messaging";
import type { Store } from "./store.js";
import { firebaseApp } from "./store.js";
import { jsonRequest } from "./providers.js";
export async function notify(
  store: Store,
  event: {
    id: string;
    uid?: string;
    email?: string;
    phone?: string;
    title: string;
    body: string;
  },
  demo = false,
) {
  for (const channel of ["email", "push", "sms"]) {
    const id = createHash("sha256")
      .update(event.id + channel)
      .digest("hex");
    const owned = await store.atomic(async (tx) => {
      const old = await tx.get("notifications", id);
      if (
        old &&
        (old.status === "sent" ||
          old.status === "sending" ||
          old.status === "unknown")
      )
        return false;
      tx.put("notifications", id, {
        id,
        eventId: event.id,
        uid: event.uid ?? null,
        channel,
        status: "sending",
        title: event.title,
        createdAt: new Date().toISOString(),
      });
      return true;
    });
    if (!owned) continue;
    let status = "skipped",
      error: string | null = null;
    try {
      if (demo) {
        status = "demo_not_sent";
      } else if (
        channel === "email" &&
        event.email &&
        process.env.RESEND_API_KEY &&
        process.env.MAIL_FROM
      ) {
        await jsonRequest("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": id,
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [event.email],
            subject: event.title,
            text: event.body,
          }),
        });
        status = "sent";
      } else if (channel === "push" && event.uid) {
        const tokens = await store.list(
          "devices",
          { field: "uid", value: event.uid },
          20,
        );
        if (tokens.length) {
          const response = await getMessaging(
            firebaseApp(),
          ).sendEachForMulticast({
            tokens: tokens.map((t) => t.token),
            notification: { title: event.title, body: event.body },
            android: { notification: { channelId: "orders" } },
          });
          status = response.failureCount ? "partial" : "sent";
          error = response.failureCount
            ? `${response.failureCount} device delivery failures`
            : null;
        }
      } else if (
        channel === "sms" &&
        event.phone &&
        process.env.TEXTBEE_API_KEY &&
        process.env.TEXTBEE_DEVICE_ID
      ) {
        await jsonRequest(
          `https://api.textbee.dev/api/v1/gateway/devices/${process.env.TEXTBEE_DEVICE_ID}/send-sms`,
          {
            method: "POST",
            headers: {
              "x-api-key": process.env.TEXTBEE_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipients: [event.phone],
              message: `${event.title}\n${event.body}`,
            }),
          },
        );
        status = "sent";
      }
    } catch {
      status = "unknown";
      error =
        "Provider failed or timed out; inspect provider history before retrying to avoid duplicate delivery";
    }
    await store.atomic(async (tx) => {
      const record = await tx.get("notifications", id);
      tx.put("notifications", id, {
        ...record,
        status,
        error,
        updatedAt: new Date().toISOString(),
      });
    });
  }
}
