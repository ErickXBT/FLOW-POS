import { db, customerOrdersTable, customerOrderItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const orders = await db.select().from(customerOrdersTable).where(eq(customerOrdersTable.customerPhone, "081237582544"));
  let calculatedPoints = 0;
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const items = await db.select().from(customerOrderItemsTable).where(eq(customerOrderItemsTable.customerOrderId, order.id));
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const pointsEarned = totalItems * 10;
    
    // Check if the order was a reward claim
    if (order.isClaimReward) {
      // In the original code, does it deduct points? No, but wait:
      // If it resets points:
      if (order.discount === "0.00") {
         // wait
      }
    }
    
    calculatedPoints += pointsEarned;
    console.log(`Order #${order.id} (${order.createdAt.toISOString()}): +${pointsEarned} points (items: ${totalItems}), cumulative: ${calculatedPoints}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
