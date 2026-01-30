import db from "../config/db.js";

function safeStr(v) {
  return String(v || "").trim();
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getUserCredits(userId) {
  const [rows] = await db.execute(
    "SELECT COALESCE(SUM(delta),0) AS credits FROM credit_ledger WHERE userId=?",
    [userId]
  );
  return Number(rows[0]?.credits || 0);
}

/* ===================== CREDITS ===================== */
export async function myCredits(req, res) {
  try {
    const credits = await getUserCredits(req.user.id);
    return res.json({ credits });
  } catch (e) {
    console.error("myCredits error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

/* ===================== LIST BOOKINGS ===================== */
export async function listBookings(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute(
      `SELECT *
       FROM bookings
       WHERE userId=?
       ORDER BY startTime DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (e) {
    console.error("listBookings error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

/* ===================== CREATE BOOKING ===================== */
export async function createBooking(req, res) {
  const conn = await db.getConnection();
  try {
    const userId = req.user.id;

    const vendor = safeStr(req.body.vendor);
    const courseSlug = safeStr(req.body.course); // slug
    const rack = safeStr(req.body.rack);
    const startISO = safeStr(req.body.startISO);
    const lengthMinutes = toInt(req.body.lengthMinutes);
    const phone = safeStr(req.body.phone);

    if (!vendor || !courseSlug || !rack || !startISO || !lengthMinutes) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ---------- COURSE ---------- */
    const [courseRows] = await conn.execute(
      `SELECT id, slug, ratePerHour, status
       FROM courses
       WHERE slug=? AND vendor=? LIMIT 1`,
      [courseSlug, vendor]
    );

    if (!courseRows.length || courseRows[0].status !== "active") {
      return res.status(400).json({ message: "Invalid course" });
    }

    const course = courseRows[0];
    const hours = Math.ceil(lengthMinutes / 60);
    const creditsNeeded = Number(course.ratePerHour) * hours;

    /* ---------- CREDITS ---------- */
    const currentCredits = await getUserCredits(userId);
    if (currentCredits < creditsNeeded) {
     return res.status(402).json({
  code: "INSUFFICIENT_CREDITS",
  required: creditsNeeded,
  available: currentCredits,
  message: "You don’t have enough credits to complete this booking."
});

    }

    /* ---------- TIME ---------- */
    const start = new Date(startISO);
if (isNaN(start.getTime())) {
  return res.status(400).json({ message: "Invalid start time" });
}

/* ✅ BLOCK PAST TIME BOOKINGS */
const now = new Date();
if (start < now) {
  return res.status(400).json({
    message: "You cannot book a time slot in the past. Please select a future time."
  });
}

const end = new Date(start.getTime() + lengthMinutes * 60 * 1000);

await conn.beginTransaction();
    /* ---------- INSERT BOOKING ---------- */
    const [ins] = await conn.execute(
      `INSERT INTO bookings
       (userId, courseId, vendor, course, rack, startTime, endTime, status, creditsUsed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RESERVED', ?)`,
      [
        userId,
        course.id,
        vendor,
        course.slug,
        rack,
        start.toISOString().slice(0, 19).replace("T", " "),
        end.toISOString().slice(0, 19).replace("T", " "),
        creditsNeeded,
      ]
    );

    const bookingId = ins.insertId;

    /* ---------- LEDGER ---------- */
    await conn.execute(
      `INSERT INTO credit_ledger (userId, bookingId, delta, reason)
       VALUES (?, ?, ?, ?)`,
      [userId, bookingId, -creditsNeeded, "Booking charge"]
    );

    /* ---------- UPDATE PHONE ---------- */
    if (phone) {
      await conn.execute(
        "UPDATE users SET phone=? WHERE id=?",
        [phone, userId]
      );
    }

    await conn.commit();

    return res.status(201).json({
      message: "Booking created",
      bookingId,
      creditsUsed: creditsNeeded,
      creditsRemaining: currentCredits - creditsNeeded,
    });
  } catch (e) {
    await conn.rollback();
    console.error("createBooking error:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  } finally {
    conn.release();
  }
}
