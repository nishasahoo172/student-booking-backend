import db from "../config/db.js";
import { sendMail } from "../services/mailer.js";
// router.get("/available-slots", requireAuth, getAvailableSlots);
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
// COURSE AUTHORIZATION
// =========================

const [allowedCourses] = await conn.execute(
  `
  SELECT 1
  FROM user_courses
  WHERE userId = ?
  AND courseId = ?
  LIMIT 1
  `,
  [
    userId,
    courseRow.id
  ]
);

if (allowedCourses.length === 0) {

  return res.status(403).json({
    code: "COURSE_NOT_ASSIGNED",
    message:
      "You are not authorized to book this lab. Please contact the administrator."
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

    // const start = new Date(startISO);
    // const end = new Date(start.getTime() + lengthMinutes * 60000);

// =========================
// 36 HOUR ADVANCE RULE
// =========================

const startDate = new Date(startISO);

const minimumBookingTime =
  new Date(
    Date.now() +
    (36 * 60 * 60 * 1000)
  );

if (startDate < minimumBookingTime) {

  return res.status(400).json({
    code: "ADVANCE_BOOKING_REQUIRED",
    message:
      "Bookings must be scheduled at least 36 hours in advance."
  });

}
const start = startISO.replace("T", " ");
const endDate = new Date(
  new Date(startISO).getTime() +
  lengthMinutes * 60000
);

const end =
  endDate.getFullYear() + "-" +
  String(endDate.getMonth() + 1).padStart(2, "0") + "-" +
  String(endDate.getDate()).padStart(2, "0") + " " +
  String(endDate.getHours()).padStart(2, "0") + ":" +
  String(endDate.getMinutes()).padStart(2, "0") + ":" +
  String(endDate.getSeconds()).padStart(2, "0");


//     console.log("========== BOOKING ==========");
// console.log("START ISO:", startISO);
// console.log("START:", start);
// console.log("END:", end);
// console.log("RACK:", rack);
// console.log("VENDOR:", vendor);
// console.log("COURSE:", course);
// console.log("=============================");
    

    // =========================
    // SLOT COLLISION CHECK
    // =========================
console.log("========== NEW BOOKING ==========");
console.log("RACK:", rack);
console.log("VENDOR:", vendor);
console.log("COURSE:", course);
console.log("START:", start);
console.log("END:", end);

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

console.log("CONFLICT COUNT:", conflict.count);
console.log("=================================");

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
// SYNC USERS.CREDITS
// =========================
await conn.execute(
  `
  UPDATE users
  SET credits =
  (
    SELECT COALESCE(
      SUM(remainingCredits),
      0
    )
    FROM credit_packages
    WHERE userId = ?
    AND expiryDate > NOW()
  )
  WHERE id = ?
  `,
  [userId, userId]
);

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
   UPCOMING BOOKING
========================= */
export async function upcomingBooking(req, res) {
  try {
    const userId = req.user.id;

    const { vendor, course } = req.query;

    const [rows] = await db.execute(
  `
  SELECT
    id,
    vendor,
    course,
    rack,
    startTime,
    endTime,
    status
  FROM bookings
  WHERE userId = ?
    AND vendor = ?
    AND course = ?
    AND status = 'RESERVED'
    AND endTime > NOW()
  ORDER BY startTime ASC
  LIMIT 1
  `,
  [
    userId,
    vendor,
    course,
  ]
);

    if (rows.length === 0) {
      return res.json(null);
    }

   const booking = rows[0];

const start = new Date(booking.startTime);
const end = new Date(booking.endTime);
// Duration
const durationHours = Math.round(
  (end - start) / (1000 * 60 * 60)
);

// Friendly Date
const dateLabel = start.toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Friendly Time
const timeLabel =
  `${start.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })} - ${end.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })}`;

// Course Display Name
const courseMap = {
  "security-scheduler": "CCIE Security",
  "dc-scheduler": "CCIE Data Center",
  "ei-scheduler": "CCIE Enterprise Infrastructure",
};

return res.json({
  ...booking,

  courseTitle:
    courseMap[booking.course] || booking.course,

  rackLabel: `Rack ${booking.rack}`,

  durationLabel: `${durationHours} Hours`,

  dateLabel,

  timeLabel,
});


  } catch (err) {
    console.error("upcomingBooking error:", err);

    return res.status(500).json({
      message: "Unable to load upcoming booking."
    });
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
    expiry.setMonth(expiry.getMonth() + 4);

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

    await db.execute(
      `
      INSERT INTO credit_ledger
      (userId, delta, reason)
      VALUES (?, ?, ?)
      `,
      [
        userId,
        credits,
        "Credit Purchase"
      ]
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

/* =========================
   AVAILABLE SLOTS
========================= */
function formatMySQLDateTime(date) {

  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0") +
    ":" +
    String(date.getSeconds()).padStart(2, "0")
  );

}
export async function getAvailableSlots(req, res) {

    try {

       const { vendor, course, rack, date, bookingId } = req.query;

        if (!vendor || !course || !rack || !date) {
            return res.status(400).json({
                message: "Missing required parameters."
            });
        }


         if (!bookingId) {
            return res.status(400).json({
                message: "Booking ID is required."
            });
        }

      // =========================
    // Load Current Booking
     // =========================

       const [[currentBooking]] = await db.execute(
      `
     SELECT
        startTime,
        endTime
     FROM bookings
     WHERE id = ?
      AND status = 'RESERVED'
     `,
     [bookingId]
    );

    if (!currentBooking) {
     return res.status(404).json({
        message: "Booking not found."
     });
     }

     // =========================
  // Calculate Booking Duration
  // =========================

     const bookingDurationMinutes =
      Math.round(
        (
            new Date(currentBooking.endTime) -
            new Date(currentBooking.startTime)
        ) / 60000
       );

        // Load all booked slots for selected rack/date
        const [bookings] = await db.execute(
          `
         SELECT
         id,
         startTime,
         endTime
         FROM bookings
         WHERE vendor = ?
         AND course = ?
         AND rack = ?
         AND status IN ('RESERVED','ACTIVE')
         AND id <> ?
         AND DATE(startTime) = ?
          ORDER BY startTime ASC
          `,
          [
        vendor,
        course,
        rack,
        bookingId,
        date
         ]
        );

       // =========================
    // Generate All Possible Slots
    // =========================

    const allSlots = [];

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

   for (
    let slotStart = new Date(dayStart);
    slotStart < dayEnd;
    slotStart.setHours(slotStart.getHours() + 1)
    ) {

    const slotEnd = new Date(slotStart);

    slotEnd.setMinutes(
        slotEnd.getMinutes() + bookingDurationMinutes
    );

    // Don't allow slots crossing midnight
    if (slotEnd > dayEnd) {
        break;
    }

    allSlots.push({
        startTime: new Date(slotStart),
        endTime: new Date(slotEnd)
    });

    }

     // STEP 6 WILL COME HERE

     // =========================
     // Remove Busy Slots
     // =========================

   const availableSlots = allSlots.filter((slot) => {

    return !bookings.some((booking) => {

        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);

        return (

            slot.startTime < bookingEnd &&
            slot.endTime > bookingStart

        );

    });

    });

    // =========================
   // Return Available Slots
    // =========================

return res.json({
  slots: availableSlots.map(slot => ({
    startTime: formatMySQLDateTime(slot.startTime),
    endTime: formatMySQLDateTime(slot.endTime),
  })),
});
   
    }
    catch (err) {

        console.error("getAvailableSlots error:", err);

        return res.status(500).json({
            message: "Failed to load available slots."
        });

    }

}

// 2️⃣ Insert into credit_ledger

export async function rescheduleBooking(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rack, startTime, endTime } = req.body;

    // Check booking belongs to logged-in user
    const [[booking]] = await db.execute(
      `
      SELECT *
      FROM bookings
      WHERE id = ?
      AND userId = ?
      AND status = 'RESERVED'
      `,
      [id, userId]
    );

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found."
      });
    }

    // Check conflict (ignore current booking)
const [conflicts] = await db.execute(
  `
  SELECT
      id,
      rack,
      startTime,
      endTime
  FROM bookings
  WHERE rack = ?
    AND vendor = ?
    AND course = ?
    AND status = 'RESERVED'
    AND id <> ?
    AND startTime < ?
    AND endTime > ?
  `,
  [
    rack,
    booking.vendor,
    booking.course,
    id,
    endTime,
    startTime
  ]
);

console.log(conflicts);

   if (conflicts.length > 0) {
      return res.status(409).json({
        message: "Selected slot is already booked."
      });
    }

console.log("Received Start:", startTime);
console.log("Received End:", endTime);

const mysqlStartTime = startTime.replace("T", " ");

const mysqlEndTime = endTime.replace("T", " ");

const conn = await db.getConnection();

try {

  await conn.query(
    "SET time_zone = '+05:30'"
  );

  await conn.execute(
    `
    UPDATE bookings
    SET rack = ?,
        startTime = ?,
        endTime = ?
    WHERE id = ?
    `,
    [
      rack,
      mysqlStartTime,
      mysqlEndTime,
      id
    ]
  );

} finally {

  conn.release();

}
    return res.json({
      message: "Booking rescheduled successfully."
    });

  } catch (err) {
    console.error("rescheduleBooking error:", err);

    return res.status(500).json({
      message: "Failed to reschedule booking."
    });
  }
}
