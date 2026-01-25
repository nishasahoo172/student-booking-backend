// backend/src/models/User.js
import db from "../config/db.js";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export async function findUserByEmail(email) {
  const e = normalizeEmail(email);
  const [rows] = await db.execute(
    "SELECT id, email, fullName, status FROM users WHERE email = ? LIMIT 1",
    [e]
  );
  return rows[0] || null;
}

export async function setUserStatusByEmail(email, status) {
  const e = normalizeEmail(email);
  const s = String(status || "").trim().toLowerCase();

  const [result] = await db.execute(
    "UPDATE users SET status = ?, updatedAt = NOW() WHERE email = ?",
    [s, e]
  );

  if (!result.affectedRows) return null;

  const [rows] = await db.execute(
    "SELECT id, email, fullName, status FROM users WHERE email = ? LIMIT 1",
    [e]
  );
  return rows[0] || null;
}
