import cron from "node-cron";
import db from "../config/db.js";

console.log("Complete booking cron loaded...");
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("Checking completed bookings...");

    await db.execute(`
      UPDATE bookings
      SET status = 'COMPLETED'
      WHERE status = 'RESERVED'
      AND endTime <= NOW()
    `);

  } catch (err) {
    console.error("Complete booking job error:", err);
  }
});