import { Router } from "express";
import { sendMail } from "../services/mailer.js";
import { setUserStatusByEmail, findUserByEmail } from "../models/User.js";
import db from "../config/db.js";

const router = Router();

/**
 * =========================================
 * APPROVE USER (from email link)
 * GET /api/admin/users/approve?email=...
 * =========================================
 */
router.get("/users/approve", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await setUserStatusByEmail(email, "active");
    if (!updated) {
      return res.status(500).json({ message: "Failed to approve user" });
    }

    // respond immediately
    res.json({
      message: "User approved successfully",
      email: updated.email,
      status: updated.status,
    });

    // send email to user
    const loginUrl =
      (process.env.FRONTEND_BASE_URL || "http://localhost:5173") + "/login";

    sendMail({
      to: updated.email,
      subject: "Account Approved",
      html: `
        <h2>Account Approved ✅</h2>
        <p>Your account is now active.</p>
        <p><a href="${loginUrl}">Login here</a></p>
      `,
    }).catch(console.error);

  } catch (err) {
    console.error("admin approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================================
 * ADMIN: LIST ALL USERS
 * GET /api/admin/users
 * =========================================
 */
router.get("/users", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        u.id,
        u.fullName,
        u.email,
        u.phone,
        u.address,
        u.country,
       u.role,
       u.status,

   COALESCE(
  (
  SELECT SUM(cp.remainingCredits)
  FROM credit_packages cp
  WHERE cp.userId = u.id
  AND cp.expiryDate > NOW()
 ),
 0
 ) AS credits,

   u.createdAt,

        COUNT(b.id) AS totalBookings,

        GROUP_CONCAT(
          DISTINCT b.course
          SEPARATOR ', '
        ) AS courses

      FROM users u

      LEFT JOIN bookings b
        ON b.userId = u.id

      GROUP BY u.id

      ORDER BY u.createdAt DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("admin users error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
});

/**

 * GET /api/admin/bookings
 * =========================================
 */
router.get("/bookings", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
        b.id,
        u.email AS userEmail,
        b.course,
        b.rack,
        b.startTime,
        b.endTime,
        b.creditsUsed,
        b.status
      FROM bookings b
      JOIN users u ON u.id = b.userId
      ORDER BY b.startTime DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("admin bookings error:", err);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

/**
 * =========================================
 * STUDENT BOOKINGS
 * GET /api/admin/users/:id/bookings
 * =========================================
 */
router.get("/users/:id/bookings", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `
      SELECT *
      FROM bookings
      WHERE userId=?
      ORDER BY createdAt DESC
      `,
      [id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Failed to load booking history"
    });

  }
});

/**
 * =========================================
 * STUDENT CREDIT HISTORY
 * GET /api/admin/users/:id/credits
 * =========================================
 */

router.get("/users/:id/credits", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `
      SELECT *
      FROM credit_ledger
      WHERE userId=?
      ORDER BY createdAt DESC
      `,
      [id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load credit history"
    });

  }
});

/**
 * =========================================
 * STUDENT DETAILS
 * GET /api/admin/users/:id
 * =========================================
 */
router.get("/users/:id", async (req, res) => {
  try {

    const { id } = req.params;
    const [[student]] = await db.execute(
      `
  SELECT
  id,
  fullName,
  email,
  phone,
  country,

  COALESCE(
  (
    SELECT SUM(cp.remainingCredits)
    FROM credit_packages cp
    WHERE cp.userId = users.id
    AND cp.expiryDate > NOW()
  ),
  0
  ) AS credits,

  role,
  status,
  createdAt
  FROM users
  WHERE id=?
      `,
      [id]
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const [bookings] = await db.execute(
      `
      SELECT
      course,
      rack,
      startTime,
      endTime,
      creditsUsed,
      status
      FROM bookings
      WHERE userId=?
      ORDER BY startTime DESC
      `,
      [id]
    );

    res.json({
      student,
      bookings
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error"
    });

  }
});
router.post("/users/:id/add-credit", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
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
        ?,
        NOW()
      )
      `,
      [id, amount, reason]
    );

const expiry = new Date();
expiry.setMonth(expiry.getMonth() + 4);

await db.execute(
  `
  INSERT INTO credit_packages
  (
    userId,
    productName,
    originalCredits,
    remainingCredits,
    price,
    expiryDate
  )
  VALUES
  (
    ?,
    'Admin Topup',
    ?,
    ?,
    0,
    ?
  )
  `,
  [
    id,
    amount,
    amount,
    expiry
  ]
);

    res.json({
      success: true,
      message: "Credits added"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to add credits"
    });

  }
});

/**
 * =========================================
 * REJECT STUDENT
 * PUT /api/admin/users/:id/reject
 * =========================================
 */
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      country,
      address,
    } = req.body;
    await db.execute(
      `
      UPDATE users
      SET
        fullName=?,
        phone=?,
        country=?,
        address=?,
        updatedAt=NOW()
      WHERE id=?
      `,
      [
        fullName,
        phone,
        country,
        address,
        id,
      ]
    );
    res.json({
      success: true,
      message: "Student updated",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to update student",
    });

  }
});

router.put(
  "/users/:id/reject",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      await db.execute(
        `
        UPDATE users
        SET
        status='rejected',
        rejectedReason=?,
        updatedAt=NOW()
        WHERE id=?
        `,
        [reason, id]
      );

      const [[user]] =
        await db.execute(
          `
          SELECT
          email,
          fullName
          FROM users
          WHERE id=?
          `,
          [id]
        );
      await sendMail({
     to: user.email,

  subject:
    "CCIE Rack Rentals - Account Status Update",

  html: `
    <div style="
      font-family: Arial, sans-serif;    
      margin: auto;
      padding: 20px;
    ">
      <h2 style="
        color: #dc2626;
        margin-bottom: 20px;
      ">
        Account Status Update
      </h2>

      <p>
        Dear ${user.fullName},
      </p>

      <p>
        Thank you for your interest in
        <strong>CCIE Rack Rentals</strong>.
      </p>
      <p>
        We regret to inform you that your account request could not be approved at this time.
      </p>
      ${
        reason?.trim()
          ? `
          <p>
            <strong>
              Reason for Rejection:
            </strong>
            <br>
            ${reason}
          </p>
          `
          : ""
      }
      <p>
        If you believe this decision was made in error or need additional information, please contact our support team.
      </p>
      <br>
      <p>
        Best Regards,
        <br>
        CCIE Rack Rentals Team
      </p>

    </div>
  `
   });
      res.json({
        message:
          "Student rejected successfully",
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Failed to reject user",
      });
    }
  }
   );

  router.get("/reports/summary", async (req, res) => {
  try {
    const [[users]] =
      await db.execute(`
        SELECT COUNT(*) total
        FROM users
      `);
    const [[active]] =
      await db.execute(`
        SELECT COUNT(*) total
        FROM users
        WHERE status='active'
      `);
    const [[pending]] =
      await db.execute(`
        SELECT COUNT(*) total
        FROM users
        WHERE status='pending'
      `);
    const [[rejected]] =
      await db.execute(`
        SELECT COUNT(*) total
        FROM users
        WHERE status='rejected'
      `);
    const [[bookings]] =
      await db.execute(`
        SELECT COUNT(*) total
        FROM bookings
      `);

    const [[credits]] =
      await db.execute(`
        SELECT
        IFNULL(SUM(delta),0) total
        FROM credit_ledger
        WHERE delta > 0
      `);

     res.json({
      totalUsers: users.total,
      activeUsers: active.total,
      pendingUsers: pending.total,
      rejectedUsers: rejected.total,
      totalBookings: bookings.total,
      totalCreditsSold: credits.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed To Load Reports"
    });

  }
  });

  router.put(
  "/users/:id/reactivate",
  async (req, res) => {

    try {
      const { id } = req.params;
      await db.execute(
        `
        UPDATE users
        SET
        status='active',
        updatedAt=NOW()
        WHERE id=?
        `,
        [id]
      );
      res.json({
        success: true,
        message:
          "Student Reactivated"
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Failed To Reactivate"
      });
    }
   }
    );

  router.get(
  "/users/:id/courses",
   async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.execute(
        `
      SELECT
      uc.courseId,
      uc.status,
      c.name,
      c.slug

     FROM user_courses uc

     JOIN courses c
     ON c.id = uc.courseId

     WHERE uc.userId = ?
        `,
        [id]
      );
    res.json(rows);
    } catch (err) {

      console.error(err);
      res.status(500).json({
        message:
          "Failed to load courses"
      });
    }
  }
  );

// APPROVE USER COURSE
router.put(
  "/users/:userId/courses/:courseId/approve",
  async (req, res) => {

    try {

      const {
        userId,
        courseId
      } = req.params;
      await db.execute(
        `
        UPDATE user_courses
        SET status='approved'
        WHERE userId=?
        AND courseId=?
        `,
        [
          userId,
          courseId
        ]
      );
      res.json({
        success: true,
        message: "Course approved successfully"
      });


    } catch (err) {

      console.error(err);

      res.status(500).json({
        message: "Failed to approve course"
      });

    }

  }
);

// REMOVE COURSE ACCESS

router.put(
  "/users/:userId/courses/:courseId/remove",
  async(req,res)=>{

    try{

      const {
        userId,
        courseId
      } = req.params;


      await db.execute(
        `
        UPDATE user_courses
        SET status='rejected'
        WHERE userId=?
        AND courseId=?
        `,
        [
          userId,
          courseId
        ]
      );
      res.json({
        success:true,
        message:"Course access removed"
      });


    }
    catch(err){
      console.error(err);
      res.status(500).json({
        message:"Failed removing course"
      });

    }

  }
);

router.post(
  "/users/:id/courses",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { courseIds } = req.body;
      await db.execute(
        `
        DELETE FROM user_courses
        WHERE userId = ?
        `,
        [id]
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
          [id, courseId]
        );
      }

      res.json({
        success: true
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        message:
          "Failed saving courses"
      });

    }

  }
);

router.post(
  "/users/:id/assign-course",
  async(req,res)=>{

    try {

      const { id } = req.params;
      const { courseIds } = req.body;
      for(const courseId of courseIds){

        const [existing] = await db.execute(
          `
          SELECT id,status
          FROM user_courses
          WHERE userId=?
          AND courseId=?
          `, 
          [
            id,
            courseId
          ]
        );


        if(existing.length){

          await db.execute(
            `
            UPDATE user_courses
            SET status='approved'
            WHERE userId=?
            AND courseId=?
            `,
            [
              id,
              courseId
            ]
          );


        }
        else{


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
              'approved',
              NOW()
            )
            `,
            [
              id,
              courseId
            ]
          );

        }

      }
      res.json({
        success:true,
        message:"Courses assigned successfully"
      });

    }
    catch(err){

      console.error(err);

      res.status(500).json({
        message:"Failed assigning courses"
      });

    }

  }
);


router.get(
"/reschedule-history",
async(req,res)=>{

try{

const [rows]=await db.execute(
`
SELECT

rh.id,

u.fullName,
u.email,


c.name AS course,

rh.oldRack,
rh.oldStartTime,
rh.oldEndTime,

rh.newRack,
rh.newStartTime,
rh.newEndTime,

rh.rescheduledBy,
rh.createdAt

FROM booking_reschedule_history rh


JOIN users u
ON u.id=rh.userId


JOIN bookings b
ON b.id=rh.bookingId


JOIN courses c
ON c.slug=b.course


ORDER BY rh.createdAt DESC

`
);


res.json(rows);


}catch(err){

console.error(err);

res.status(500).json({
message:"Failed loading reschedule history"
});

}


});

export default router;
