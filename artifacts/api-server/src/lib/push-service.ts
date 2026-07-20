import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const PUBLIC_VAPID_KEY = process.env.VAPID_PUBLIC_KEY || "BOFbcU_2a4YbM_CG_tY-LAVf-4xH2ivi-GuQWJX-AOonVyrBu524Ms7tRgWNG37KupVMBqgS3jr3L5T3LqT7N0I";
const PRIVATE_VAPID_KEY = process.env.VAPID_PRIVATE_KEY || "0O3Ap1Zb_Id7eGPViDQlV5ZLVvqEiuiiZ3X74CqOsXI";

try {
  webpush.setVapidDetails(
    "mailto:support@flowapp.id",
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
  );
} catch (err) {
  logger.error(err, "Failed to set VAPID details for Web Push");
}

export { PUBLIC_VAPID_KEY };

export async function savePushSubscription(tenantId: number, userId: number, subscription: any, userAgent?: string) {
  if (!subscription || !subscription.endpoint || !subscription.keys) return;

  const existing = await db
    .select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, subscription.endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptionsTable)
      .set({
        tenantId,
        userId,
        keys: subscription.keys,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptionsTable.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      tenantId,
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: userAgent || null,
    });
  }
}

export async function sendPushNotificationToTenantOwners(tenantId: number, payload: { title: string; body: string; url?: string; orderId?: number }) {
  try {
    const subs = await db
      .select({
        id: pushSubscriptionsTable.id,
        endpoint: pushSubscriptionsTable.endpoint,
        keys: pushSubscriptionsTable.keys,
      })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.tenantId, tenantId));

    if (subs.length === 0) return;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/customer-orders",
      orderId: payload.orderId,
    });

    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id)).catch(() => {});
        } else {
          logger.error(err, `Web push notification error for sub ${sub.id}`);
        }
      }
    }
  } catch (err) {
    logger.error(err, `Failed to send push notification to tenant ${tenantId}`);
  }
}
