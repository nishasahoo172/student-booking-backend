import db from "../config/db.js";
import { sendMail } from "../services/mailer.js";

/* =========================
   HELPERS
========================= */
// async function getUserCredits(userId) {
//   const [[r]] = await db.execute(
//     "SELECT COALESCE(SUM(delta),0) AS credits FROM credit_ledger WHERE userId=?",
//     [userId]
//   );
//   return Number(r.credits || 0);
// }
async function getUserCredits(userId) {
  const [rows] = await db.execute(
    `
    SELECT COALESCE(SUM(remainingCredits),0) as total
    FROM credit_packages
    WHERE userId = ?
    AND expiryDate > NOW()
    `,
    [userId]
  );

  return rows[0].total || 0;
}
/* =========================
   MY CREDITS
========================= */
export async function myCredits(req, res) {
  try {
    const credits = await getUserCredits(req.user.id);
    return res.json({ credits });
  } catch (err) {
    console.error("myCredits error:", err);
    return res.status(500).json({
      message: "Unable to load your credit balance.",
    });
  }
}
/* =========================
   MY BOOKINGS
========================= */
export async function listMyBookings(req, res) {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM bookings WHERE userId=? ORDER BY startTime DESC",
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("listMyBookings error:", err);
    return res.status(500).json({
      message: "Unable to load your bookings.",
    });
  }
}
/* =========================
   CREATE BOOKING (PRODUCTION SAFE)
========================= */
export async function createBooking(req, res) {
  const conn = await db.getConnection();

  try {
    const userId = req.user.id;
    const { vendor, course, rack, startISO, lengthMinutes, phone } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if (!vendor || !course || !rack || !startISO || !lengthMinutes) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "Please complete all required booking details."
      });
    }

    const [[courseRow]] = await conn.execute(
      `SELECT id 
       FROM courses 
       WHERE slug=? AND vendor=? AND status='active'`,
      [course, vendor]
    );

    if (!courseRow) {
      return res.status(400).json({
        code: "COURSE_UNAVAILABLE",
        message: "The selected lab is currently unavailable."
      });
    }

    // =========================   
    // FIXED SLAB PRICING POLICY
    // =========================
    const PRICING_RULES = {
      180: 30, // 3 hours
      240: 30, // 4 hours
      480: 60  // 8 hours
    };

    const creditsNeeded = PRICING_RULES[lengthMinutes];
    if (!creditsNeeded) {
      return res.status(400).json({
        code: "INVALID_DURATION",
        message: "Invalid booking duration selected."
      });
    }

    const availableCredits = await getUserCredits(userId);
    if (availableCredits < creditsNeeded) {
      return res.status(402).json({
        code: "INSUFFICIENT_CREDITS",
        required: creditsNeeded,
        available: availableCredits,
        message: `You need ${creditsNeeded} credits but only ${availableCredits} are available.`
      });
    }

    const start = new Date(startISO);
    const end = new Date(start.getTime() + lengthMinutes * 60000);

    // =========================
    // SLOT COLLISION CHECK
    // =========================
  const [[conflict]] = await conn.execute(
  `
  SELECT COUNT(*) as count
  FROM bookings
  WHERE rack = ?
  AND vendor = ?
  AND course = ?
  AND status = 'RESERVED'
  AND startTime < ?
  AND endTime > ?
  `,
  [
    rack,
    vendor,
    course,
    end,
    start
  ]
);
if (conflict.count > 0) {
  return res.status(409).json({
    code: "SLOT_UNAVAILABLE",
    message:
      "This rack is unavailable for the selected timing. Please choose another available slot."
  });
}

    // =========================
    // TRANSACTION
    // =========================
    await conn.beginTransaction();

    const [ins] = await conn.execute(
      `INSERT INTO bookings
       (userId, courseId, vendor, course, rack, startTime, endTime, status, creditsUsed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RESERVED', ?)`,
      [
        userId,
        courseRow.id,
        vendor,
        course,
        rack,
        start,
        end,
        creditsNeeded
      ]
    );

  let creditsToDeduct = creditsNeeded;

const [packages] = await conn.execute(
  `
  SELECT *
  FROM credit_packages
  WHERE userId = ?
  AND remainingCredits > 0
  AND expiryDate > NOW()
  ORDER BY expiryDate ASC
  `,
  [userId]
);

for (const pkg of packages) {

  if (creditsToDeduct <= 0) break;

  const deduct = Math.min(
    pkg.remainingCredits,
    creditsToDeduct
  );

  // Deduct from package
  await conn.execute(
    `
    UPDATE credit_packages
    SET remainingCredits = remainingCredits - ?
    WHERE id = ?
    `,
    [deduct, pkg.id]
  );

  creditsToDeduct -= deduct;
}

// =========================
// ADD LEDGER ENTRY
// =========================
await conn.execute(
  `
  INSERT INTO credit_ledger
  (userId, bookingId, delta, reason)
  VALUES (?, ?, ?, ?)
  `,
  [
    userId,
    ins.insertId,
    -creditsNeeded,
    "Booking charge"
  ]
);

// =========================
// UPDATE PHONE
// =========================
if (phone) {

  await conn.execute(
    `
    UPDATE users
    SET phone = ?
    WHERE id = ?
    `,
    [phone, userId]
  );
}

// =========================
// COMMIT
// =========================
await conn.commit();

return res.status(201).json({
  message: "Reservation confirmed successfully.",
  creditsRemaining:
    availableCredits - creditsNeeded
});


  } catch (err) {
    await conn.rollback();
    console.error("createBooking error:", err);
    return res.status(500).json({
      message: "Unexpected system error. Please try again."
    });
  } finally {
    conn.release();
  }
}
/* =========================
   PURCHASE HISTORY
========================= */
export async function purchaseHistory(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT 
        productName,
        price,
       originalCredits,
       remainingCredits,
        expiryDate,
        createdAt
      FROM credit_packages
      WHERE userId = ?
      ORDER BY createdAt DESC
      `,
      [userId]
    );

    res.json(rows);

  } catch (err) {
    console.error("purchaseHistory error:", err);
    res.status(500).json({ message: "Failed to load purchase history" });
  }
}
/* =========================
   CREDIT HISTORY
========================= */
export async function creditHistory(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT id, delta, reason, createdAt
       FROM credit_ledger
       WHERE userId = ?
       ORDER BY createdAt DESC`,
      [userId]
    );

    const credits = await getUserCredits(userId);

    return res.json({
      credits,
      history: rows,
    });

  } catch (err) {
    console.error("creditHistory error:", err);
    return res.status(500).json({
      message: "Unable to load credit history."
    });
  }
}
/* =========================
   BUY CREDITS
========================= */
export async function buyCredits(req, res) {
  try {
    const userId = req.user.id;
    const { credits, price } = req.body;

    if (!credits || credits <= 0) {
      return res.status(400).json({
        message: "Invalid credit amount."
      });
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 4); // 6 months validity

    // 1️⃣ Insert into credit_packages
    const [pkg] = await db.execute(
      `
      INSERT INTO credit_packages
      (userId, productName, originalCredits, remainingCredits, price, expiryDate)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        "Credit Package",
        credits,
        credits,
        price || 0,
        expiry
      ]
    );

    // 2️⃣ Insert into credit_ledger
    await db.execute(
      `
     INSERT INTO credit_packages
    (userId, productName, originalCredits, remainingCredits, price, expiryDate)
      `,
      [userId, credits]
    );

    res.json({
      message: "Credits purchased successfully",
      packageId: pkg.insertId
    });

  } catch (err) {
    console.error("buyCredits error:", err);
    res.status(500).json({
      message: "Failed to purchase credits."
    });
  }
}
