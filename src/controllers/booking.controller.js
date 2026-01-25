import db from "../config/db.js";
import { isoToMysqlUtc, mysqlUtcToIso } from "../utils/datetime.js";


function norm(v) {
  return String(v || "").trim();
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

export async function createBooking(req, res) {
  try {
    const userId = req.user?.id;
    const vendor = norm(req.body.vendor);
    const course = norm(req.body.course);
    const rack = norm(req.body.rack);
    const startISO = norm(req.body.start);
    const lengthMinutes = Number(req.body.lengthMinutes);
    const fullName = norm(req.body.fullName);
    const email = norm(req.body.email).toLowerCase();
    const phone = norm(req.body.phone);
    const coupon = norm(req.body.coupon);

    const missing = [];
    if (!userId) missing.push("userId");
    if (!vendor) missing.push("vendor");
    if (!course) missing.push("course");
    if (!rack) missing.push("rack");
    if (!startISO) missing.push("start");
    if (!lengthMinutes || Number.isNaN(lengthMinutes)) missing.push("lengthMinutes");
    if (!fullName) missing.push("fullName");
    if (!email || !isEmail(email)) missing.push("email");
    if (!phone) missing.push("phone");

    if (missing.length) {
      return res.status(400).json({ message: "Missing required fields", missing });
    }

    const startTime = new Date(startISO);
    if (Number.isNaN(startTime.getTime())) {
      return res.status(400).json({ message: "Invalid start time" });
    }

    const endTime = new Date(startTime.getTime() + lengthMinutes * 60 * 1000);

    if (startTime.getTime() < Date.now()) {
      return res.status(400).json({ message: "Cannot book past time" });
    }

    // ✅ Convert to MySQL UTC DATETIME strings
    const startMysql = isoToMysqlUtc(startTime.toISOString());
    const endMysql = isoToMysqlUtc(endTime.toISOString());

    // ✅ conflict check (only blocks same vendor+course+same rack)
    const [conflicts] = await db.execute(
      `
      SELECT id FROM bookings
      WHERE vendor=? AND course=? AND rack=?
        AND status IN ('RESERVED','ACTIVE')
        AND NOT (endTime <= ? OR startTime >= ?)
      LIMIT 1
      `,
      [vendor, course, rack, startMysql, endMysql]
    );

    if (conflicts.length) {
      return res.status(409).json({ message: "Selected rack is not available for that time." });
    }

    const [result] = await db.execute(
      `
      INSERT INTO bookings
        (userId, vendor, course, rack, startTime, endTime, status, creditsUsed, reminderSentAt, createdAt, updatedAt)
      VALUES
        (?, ?, ?, ?, ?, ?, 'RESERVED', 0, NULL, NOW(), NOW())
      `,
      [userId, vendor, course, rack, startMysql, endMysql]
    );

    return res.json({
      message: "Booking created",
      booking: {
        id: result.insertId,
        userId,
        vendor,
        course,
        rack,
        startTime: startTime.toISOString(), // return ISO for frontend
        endTime: endTime.toISOString(),
        status: "RESERVED",
      },
    });
  } catch (err) {
    console.error("createBooking error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
