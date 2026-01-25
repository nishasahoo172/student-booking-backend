// backend/src/routes/admin.routes.js
import { Router } from "express";
import { sendMail } from "../services/mailer.js";
import { setUserStatusByEmail, findUserByEmail } from "../models/User.js";

const router = Router();

// GET /api/admin/users/approve?email=...
router.get("/users/approve", async (req, res, next) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email is required" });

    // 1) Find user
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2) Approve user in DB (this is the MAIN action)
    const updated = await setUserStatusByEmail(email, "active");
    if (!updated) return res.status(500).json({ message: "Could not update user status" });

    // 3) Send response immediately (email failures should not break approval)
    res.json({ message: "Approved", user: { email: updated.email, status: updated.status } });

    // 4) Fire-and-forget emails (NO crash even if SMTP fails)
    const loginUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

    // email to user
    sendMail({
      to: updated.email,
      subject: "Account approved — you can login now",
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Account approved ✅</h2>
          <p>Hi ${updated.fullName || "there"},</p>
          <p>Your account is approved. You can login now:</p>
          <p><a href="${loginUrl}">${loginUrl}</a></p>
        </div>
      `,
      text: `Your account is approved. Login: ${loginUrl}`,
    }).catch((e) => console.error("approve user mail error:", e?.message || e));

    // email to admin (optional)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail) {
      sendMail({
        to: adminEmail,
        subject: "User approved",
        text: `Approved user: ${updated.email}`,
      }).catch((e) => console.error("approve admin mail error:", e?.message || e));
    }
  } catch (err) {
    next(err); // goes to global error handler with real stack trace
  }
});

export default router;
