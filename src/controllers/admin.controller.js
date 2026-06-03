import db from "../config/db.js";
import { sendMail } from "../services/mailer.js";

/* DASHBOARD */
export async function getDashboardStats(req, res) {
  const [[u]] = await db.execute("SELECT COUNT(*) total FROM users");
  const [[p]] = await db.execute(
    "SELECT COUNT(*) pending FROM users WHERE status='pending'"
  );
  const [[b]] = await db.execute("SELECT COUNT(*) total FROM bookings");

  res.json({
    totalUsers: u.total,
    pendingUsers: p.pending,
    totalBookings: b.total,
  });
}

/* USERS */
export async function listUsers(req, res) {
  const [rows] = await db.execute(
    "SELECT id,email,role,status,createdAt FROM users ORDER BY createdAt DESC"
  );
  res.json(rows);
}

/* APPROVE USER */
export async function approveUser(req, res) {
  const { id } = req.params;

  await db.execute(
    "UPDATE users SET status='active', updatedAt=NOW() WHERE id=?",
    [id]
  );

  const [[user]] = await db.execute(
    "SELECT email,fullName FROM users WHERE id=?",
    [id]
  );

 await sendMail({
  to: user.email,
  subject: "Your Account Is Approved",
  html: `
    <p>Hello ${user.fullName || "User"},</p>
    <p>Your account has been approved.</p>
    <p>You can now log in and book labs.</p>
  `,
});

  res.json({ message: "User approved" });
}

/* ADD CREDITS */
export async function addCredits(req, res) {
  const { userId, amount } = req.body;

  await db.execute(
    `INSERT INTO credit_ledger (userId, delta, reason, createdAt)
     VALUES (?, ?, 'Admin top-up', NOW())`,
    [userId, Number(amount)]
  );

  res.json({ message: "Credits added" });
}
