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
  try {

    const { userId, amount } = req.body;

    const creditAmount =
      Number(amount);

    // CREDIT LEDGER

    await db.execute(
      `
      INSERT INTO credit_ledger
      (
        userId,
        delta,
        reason,
        createdAt
      )
      VALUES
      (
        ?,
        ?,
        'Admin top-up',
        NOW()
      )
      `,
      [userId, creditAmount]
    );

    // CREDIT PACKAGE

    await db.execute(
      `
      INSERT INTO credit_packages
      (
        userId,
        productName,
        originalCredits,
        remainingCredits,
        totalCredits,
        price,
        expiryDate,
        createdAt
      )
      VALUES
      (
        ?,
        'Admin Credit',
        ?,
        ?,
        ?,
        0,
       DATE_ADD(NOW(), INTERVAL 4 MONTH),
        NOW()
      )
      `,
      [
        userId,
        creditAmount,
        creditAmount,
        creditAmount
      ]
    );

// new
    await db.execute(
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


    res.json({
      success: true,
      message:
        "Credits added successfully"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message:
        "Failed to add credits"
    });

  }
}

export async function getUserCourses(req, res) {

  try {

    const { userId } = req.params;

    const [rows] = await db.execute(
      `
      SELECT courseId
      FROM user_courses
      WHERE userId = ?
      `,
      [userId]
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed loading courses"
    });

  }

}

export async function saveUserCourses(req, res) {

  try {

    const { userId } = req.params;
    const { courseIds } = req.body;

    await db.execute(
      `
      DELETE FROM user_courses
      WHERE userId = ?
      `,
      [userId]
    );

    for (const courseId of courseIds) {

      await db.execute(
        `
        INSERT INTO user_courses
        (
          userId,
          courseId
        )
        VALUES
        (
          ?,
          ?
        )
        `,
        [userId, courseId]
      );

    }

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed saving courses"
    });

  }

}