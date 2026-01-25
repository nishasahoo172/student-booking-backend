// backend/src/jobs/reminders.js
import cron from "node-cron";
import { listBookingsStartingSoon, markReminderSent } from "../data/demoStore.js";
import { sendMail } from "../services/mailer.js";

function formatLocalTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function startReminderCron() {
  console.log("⏰ Reminder cron started (runs every minute, sends within next 30 minutes)");

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);

    const bookings = listBookingsStartingSoon(now, soon);

    // ✅ helpful debug (you can remove later)
    if (bookings.length) {
      console.log(`[reminder] ${bookings.length} booking(s) need reminder now.`);
    }

    for (const b of bookings) {
      try {
        const subject = "Reminder: Your rack booking starts soon";
        const startTime = formatLocalTime(b.start);

        const text = `Hello ${b.fullName || "there"},

This is a reminder that your rack booking will start soon.

Course: ${b.course}
Start time: ${startTime}

Thank you,
CCIE Rack Rentals`;

        await sendMail({
          to: b.email,
          subject,
          text,
        });

        markReminderSent(b.id, new Date().toISOString());
        console.log("✅ Reminder sent:", b.email, "|", b.course, "|", startTime);
      } catch (err) {
        console.error("❌ Reminder failed:", b?.email, err?.message || err);
      }
    }
  });
}
