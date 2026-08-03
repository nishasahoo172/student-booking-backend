import db from "../config/db.js";

export async function requireCourseAccess(req, res, next) {
  try {
    // Admin can access everything
    if (req.user?.role === "admin") {
      return next();
    }

    const vendor = String(req.query.vendor || req.body.vendor || "").trim();
    const course = String(req.query.course || req.body.course || "").trim();

    if (!vendor || !course) {
      return res.status(400).json({
        code: "COURSE_INFORMATION_MISSING",
        title: "Invalid Request",
        message: "Course information is missing.",
      });
    }

    const [[courseRow]] = await db.execute(
      `
      SELECT id
      FROM courses
      WHERE slug = ?
      AND vendor = ?
      LIMIT 1
      `,
      [course, vendor]
    );

    if (!courseRow) {
      return res.status(404).json({
        code: "COURSE_NOT_FOUND",
        title: "Course Not Found",
        message: "The requested training course could not be found.",
      });
    }

   const [allowed] = await db.execute(
  `
  SELECT 1
  FROM user_courses
  WHERE userId = ?
  AND courseId = ?
  AND status = 'approved'
  LIMIT 1
  `,
  [
    req.user.id,
    courseRow.id
  ]
);

    if (!allowed.length) {
      return res.status(403).json({
        code: "COURSE_ACCESS_DENIED",
        title: "Access Restricted",
        message:
          "You do not currently have access to this training lab.",
        description:
          "This training lab has not been assigned to your account. Please contact your administrator or the NSGT support team if you require access.",
      });
    }

    next();
  } catch (err) {
    console.error("courseAccess error:", err);

    return res.status(500).json({
      code: "COURSE_ACCESS_ERROR",
      title: "System Error",
      message: "Unable to verify your course access at this time.",
    });
  }
}