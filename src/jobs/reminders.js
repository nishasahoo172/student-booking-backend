import cron from "node-cron";
import db from "../config/db.js";
import { sendMail } from "../services/mailer.js";

console.log("Reminder cron loaded...");

cron.schedule("* * * * *", async () => {

  try {

    console.log("Checking reminders...");

    const [rows] = await db.execute(`
      SELECT 
        b.id,
        b.startTime,
        u.email,
        u.fullName,
        c.name
      FROM bookings b
      JOIN users u ON u.id = b.userId
      JOIN courses c ON c.id = b.courseId
      WHERE b.reminderSent = 0
      AND b.status = 'RESERVED'
      AND TIMESTAMPDIFF(
      MINUTE,
      CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30'),
      b.startTime
      )
      BETWEEN 19 AND 20
    `);

    console.log("Rows found:", rows.length);

    for (const r of rows) {

      console.log("Sending reminder to:", r.email);

      await sendMail({
        to: r.email,
        subject: "Lab Starting in 20 Minutes",
        html: `
          <h2>Hello ${r.fullName}</h2>

          <p>Your lab starts in 20 minutes.</p>

          <p>
            <b>Course:</b> ${r.name}
          </p>

          <p>
            <b>Start Time:</b> ${r.startTime}
          </p>
        `
      });

      await db.execute(
        `UPDATE bookings
         SET reminderSent = 1
         WHERE id = ?`,
        [r.id]
      );

      console.log("Reminder updated:", r.id);
    }

  } catch (err) {

    console.error("Reminder cron error:", err);

  }

});