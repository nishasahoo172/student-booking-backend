// backend/src/controllers/auth.controller.js
import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendMail } from "../services/mailer.js";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeStr(v) {
  return String(v || "").trim();
}

export async function register(req, res) {
  try {
    // ✅ Use email as login (your UI uses email)
    const email = normalizeEmail(req.body.email || req.body.username || req.body.login);
    const password = safeStr(req.body.password);
    const fullName = safeStr(req.body.fullName);

    // ✅ Frontend sends timeZone, but old backend reads timezone
    const tz = safeStr(req.body.timeZone || req.body.timezone || req.body.tz);

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const [exists] = await db.execute(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    if (exists.length) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Insert user as pending (admin must approve)
    await db.execute(
      `INSERT INTO users (email, passwordHash, fullName, status, timezone, createdAt, updatedAt)
       VALUES (?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [email, passwordHash, fullName, tz]
    );

    // ✅ Send approval email to admin
    const adminEmail = safeStr(process.env.ADMIN_EMAIL);
    if (adminEmail) {
      const approveUrl = `http://localhost:${process.env.PORT || 5001}/api/admin/users/approve?email=${encodeURIComponent(
        email
      )}`;

      try {
        await sendMail({
          to: adminEmail,
          subject: "New user pending approval",
          html: `
            <div style="font-family:Arial,sans-serif">
              <h2>New user pending approval</h2>
              <p><b>Name:</b> ${fullName || "-"}</p>
              <p><b>Email:</b> ${email}</p>
              <p>
                <a href="${approveUrl}" style="display:inline-block;padding:10px 14px;background:#0b5cff;color:#fff;text-decoration:none;border-radius:6px">
                  Approve User
                </a>
              </p>
              <p style="color:#666;font-size:12px">If the button does not work, copy this link:</p>
              <p style="font-size:12px">${approveUrl}</p>
            </div>
          `,
          text: `Approve user: ${approveUrl}`,
        });
      } catch (e) {
        console.error("❌ admin mail error:", e?.message || e);
      }
    } else {
      console.log("⚠️ ADMIN_EMAIL not set. Admin approval email not sent.");
    }

    return res.json({ message: "Registered. Awaiting admin approval." });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body.email || req.body.username || req.body.login);
    const password = safeStr(req.body.password);

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const [rows] = await db.execute(
      `SELECT id, email, fullName, status, passwordHash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    // ✅ block login until approved
    if (String(user.status).toLowerCase() !== "active") {
      return res.status(403).json({
        code: "ACCOUNT_NOT_APPROVED",
        message: "Account pending admin approval",
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
