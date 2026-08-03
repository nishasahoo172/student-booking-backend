import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendMail } from "../services/mailer.js";

const normalize = (v) => String(v || "").trim().toLowerCase();

/* ================= REGISTER ================= */
export async function register(req, res) {
  try {
   const email = normalize(req.body.email);
const password = String(req.body.password || "").trim();
const fullName = String(req.body.fullName || "").trim();

const phone = String(req.body.phone || "").trim();
const address = String(req.body.address || "").trim();
const country = String(req.body.country || "").trim();
const timezone = String(req.body.timezone || "").trim();
const courses = req.body.courses || [];
    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const [exists] = await db.execute(
      "SELECT id FROM users WHERE email=?",
      [email]
    );
    if (exists.length) {
      return res.status(409).json({ message: "User exists" });
    }

    const hash = await bcrypt.hash(password, 10);

  const [userResult] = await db.execute(
 `
 INSERT INTO users
 (
 email,
 passwordHash,
 fullName,
 phone,
 address,
 country,
 timezone,
 role,
 status,
 createdAt,
 updatedAt
 )
 VALUES
 (
 ?,
 ?,
 ?,
 ?,
 ?,
 ?,
 ?,
 'user',
 'pending',
 NOW(),
 NOW()
 )
 `,
 [
 email,
 hash,
 fullName,
 phone,
 address,
 country,
 timezone
 ]
);

// ================= SAVE USER COURSES =================

const userId = userResult.insertId;

for (const slug of courses) {

  const [courseRows] = await db.execute(
    `
    SELECT id 
    FROM courses
    WHERE slug = ?
    `,
    [slug]
  );


  if (courseRows.length > 0) {

    await db.execute(
  `
    INSERT INTO user_courses
    (
    userId,
    courseId,
    status,
    createdAt
     )
    VALUES
    (
    ?,
    ?,
    'pending',
    NOW()
    )
   `,
   [
    userId,
    courseRows[0].id
   ]
  );

  }

}


// ================= SEND RESPONSE FAST =================

res.json({
  message: "Registered. Awaiting admin approval."
});


// ================= BACKGROUND EMAILS =================

sendMail({
  to: email,
  subject: "Account Created – Pending Approval",
  html: `
    <p>Hello ${fullName || "User"},</p>
    <p>Your account has been created successfully.</p>
    <p><b>Status:</b> Pending admin approval.</p>
    <p>You will receive another email once approved.</p>
  `,
}).catch((err)=>{
  console.error("User mail error:", err);
});


sendMail({
  to: process.env.ADMIN_EMAIL,
  subject: "New User Pending Approval",
  html: `
    <p><b>New user registration pending approval</b></p>
    <p><b>Name:</b> ${fullName || "N/A"}</p>
    <p><b>Email:</b> ${email}</p>
    <p>Status: <b>Pending</b></p>
    <p>Please approve the user from the Admin Dashboard.</p>
  `,
}).catch((err)=>{
  console.error("Admin mail error:", err);
});

    res.json({ message: "Registered. Awaiting admin approval." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

/* ================= LOGIN ================= */
export async function login(req, res) {
  try {
    const email = normalize(req.body.email);
    const password = String(req.body.password || "").trim();

    const [rows] = await db.execute(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    if (user.status !== "active") {
      return res.status(403).json({
        code: "ACCOUNT_NOT_APPROVED",
        message: "Waiting for admin approval",
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}
